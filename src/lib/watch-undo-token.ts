import { SignJWT, jwtVerify } from "jose";
import { getAuthConfiguration } from "@/lib/auth-config";

const WATCH_UNDO_ISSUER = "tvtime";
const WATCH_UNDO_AUDIENCE = "tvtime-watch-undo";
const WATCH_UNDO_TOKEN_TTL = "8s";
const PUBLIC_DEVELOPMENT_SECRET = "tvtime-public-development-watch-undo-key-v1";
const ENCODER = new TextEncoder();

export type MediaWatchSnapshot = {
  watched: boolean;
  watchedAt: string | null;
  status: string | null;
  userRating: number | null;
  rewatch: boolean;
  rewatchCount: number;
  tags: string[];
};

export type EpisodeRowSnapshot = {
  seasonNumber: number;
  episodeNumber: number;
  row: {
    episodeName: string | null;
    runtime: number | null;
    watchedAt: string;
  } | null;
};

export type WatchUndoPayload =
  | {
      kind: "movie";
      userId: string;
      mediaId: string;
      mediaBefore: MediaWatchSnapshot;
    }
  | {
      kind: "episodes";
      userId: string;
      showId: number;
      mediaId: string;
      mediaBefore: MediaWatchSnapshot | null;
      episodesBefore: EpisodeRowSnapshot[];
      rewatchCreatedAt: string | null;
    };

function signingSecret(): Uint8Array {
  const configuration = getAuthConfiguration();
  if (configuration.mode === "authenticated" && configuration.sessionSecret) {
    return ENCODER.encode(configuration.sessionSecret);
  }
  if (configuration.mode === "public" && !configuration.production) {
    return ENCODER.encode(PUBLIC_DEVELOPMENT_SECRET);
  }
  throw new Error("Watch undo is unavailable because authentication is not configured.");
}

export function mediaWatchSnapshot(item: {
  watched: boolean;
  watchedAt: Date | null;
  status: string | null;
  userRating: number | null;
  rewatch: boolean;
  rewatchCount: number;
  tags: string[];
}): MediaWatchSnapshot {
  return {
    watched: item.watched,
    watchedAt: item.watchedAt?.toISOString() ?? null,
    status: item.status,
    userRating: item.userRating,
    rewatch: item.rewatch,
    rewatchCount: item.rewatchCount,
    tags: [...item.tags],
  };
}

export async function issueWatchUndoToken(payload: WatchUndoPayload): Promise<string> {
  return new SignJWT({ watchUndo: payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(WATCH_UNDO_ISSUER)
    .setAudience(WATCH_UNDO_AUDIENCE)
    .setIssuedAt()
    // The UI exposes Undo for exactly five seconds. A short transport grace
    // lets a click made at the end of that window still reach the server.
    .setExpirationTime(WATCH_UNDO_TOKEN_TTL)
    .sign(signingSecret());
}

export async function verifyWatchUndoToken(token: string): Promise<WatchUndoPayload> {
  const { payload } = await jwtVerify(token, signingSecret(), {
    issuer: WATCH_UNDO_ISSUER,
    audience: WATCH_UNDO_AUDIENCE,
  });
  const value = payload.watchUndo;
  if (!value || typeof value !== "object") throw new Error("Invalid watch undo token.");
  const undo = value as WatchUndoPayload;
  if (undo.kind !== "movie" && undo.kind !== "episodes") throw new Error("Invalid watch undo operation.");
  if (typeof undo.userId !== "string" || undo.userId.length === 0) throw new Error("Invalid watch undo owner.");
  return undo;
}
