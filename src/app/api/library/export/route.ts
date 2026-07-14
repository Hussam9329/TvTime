import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";

/**
 * GET /api/library/export
 *
 * Streams the user's complete library as a single JSON document, but does
 * so progressively via a ReadableStream so that:
 * - Server memory stays flat (batches of 500 rows instead of loading all
 *   33,688 watched episodes + 4,043 media rows into memory at once)
 * - The Vercel function doesn't hit the 10s timeout on cold large exports
 * - The client can still call `await res.json()` and get the same shape it
 *   always got — the streamed output is a valid single JSON object
 *
 * Output shape (identical to the previous non-streaming version):
 * {
 *   version: 4,
 *   exportedAt: string,
 *   app: "CineTrack",
 *   source: string,
 *   user: { name, avatar, createdAt },
 *   library: { media: [...], watchedEpisodes: [...], episodeRatings: [...] }
 * }
 *
 * The client (ProfileDialog) does NOT need to change — it already calls
 * `res.json()` which works regardless of whether the body was streamed.
 */
export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getOrCreateUser(parseUserId(req));
  } catch (error) {
    console.error("[library:export] user lookup failed", error);
    return NextResponse.json({ error: "Failed to export library" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const userId = user.id;

  // Helper to enqueue a JSON-encoded chunk into the stream.
  // We keep a single object scope so we can reference counts at the end.
  let mediaCount = 0;
  let watchedEpisodesCount = 0;
  let episodeRatingsCount = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // ── Header ───────────────────────────────────────────────
        // Write the top-level object OPEN and its scalar keys, then open
        // the "library" object. We do NOT close the top-level object here
        // — that happens at the very end after all arrays are streamed.
        //
        // Manual JSON construction (not JSON.stringify) because we need to
        // leave the object open for streaming. Each scalar value is still
        // JSON-encoded individually for safety (escapes quotes, etc.).
        const headerScalars = [
          `"version":4`,
          `"exportedAt":${JSON.stringify(new Date().toISOString())}`,
          `"app":${JSON.stringify("CineTrack")}`,
          `"source":${JSON.stringify("Media+WatchedEpisode+Rating:episode-only")}`,
          `"user":${JSON.stringify({ name: user.name, avatar: user.avatar, createdAt: user.createdAt })}`,
        ];
        controller.enqueue(
          encoder.encode("{" + headerScalars.join(",") + ',"library":{'),
        );

        // ── media array (streamed in batches of 500) ─────────────
        controller.enqueue(encoder.encode('"media":['));
        {
          let offset = 0;
          let isFirst = true;
          while (true) {
            const batch = await db.media.findMany({
              where: { userId },
              take: BATCH_SIZE,
              skip: offset,
              orderBy: { id: "asc" },
            });
            if (batch.length === 0) break;
            for (const item of batch) {
              const normalized = normalizeMedia(item);
              controller.enqueue(
                encoder.encode((isFirst ? "" : ",") + JSON.stringify(normalized)),
              );
              isFirst = false;
              mediaCount++;
            }
            offset += batch.length;
            if (batch.length < BATCH_SIZE) break;
          }
        }
        controller.enqueue(encoder.encode("],"));

        // ── watchedEpisodes array (streamed in batches of 500) ────
        controller.enqueue(encoder.encode('"watchedEpisodes":['));
        {
          let offset = 0;
          let isFirst = true;
          while (true) {
            const batch = await db.watchedEpisode.findMany({
              where: { userId },
              take: BATCH_SIZE,
              skip: offset,
              orderBy: { id: "asc" },
            });
            if (batch.length === 0) break;
            for (const item of batch) {
              controller.enqueue(
                encoder.encode((isFirst ? "" : ",") + JSON.stringify(item)),
              );
              isFirst = false;
              watchedEpisodesCount++;
            }
            offset += batch.length;
            if (batch.length < BATCH_SIZE) break;
          }
        }
        controller.enqueue(encoder.encode("],"));

        // ── episodeRatings array (streamed in batches of 500) ─────
        controller.enqueue(encoder.encode('"episodeRatings":['));
        {
          let offset = 0;
          let isFirst = true;
          while (true) {
            const batch = await db.rating.findMany({
              where: { userId, mediaType: { startsWith: "episode:" } },
              take: BATCH_SIZE,
              skip: offset,
              orderBy: { id: "asc" },
            });
            if (batch.length === 0) break;
            for (const item of batch) {
              controller.enqueue(
                encoder.encode((isFirst ? "" : ",") + JSON.stringify(item)),
              );
              isFirst = false;
              episodeRatingsCount++;
            }
            offset += batch.length;
            if (batch.length < BATCH_SIZE) break;
          }
        }
        controller.enqueue(encoder.encode("]"));

        // ── Close library object and top-level object ────────────
        controller.enqueue(encoder.encode("}}"));

        controller.close();
      } catch (error) {
        console.error("[library:export] stream error", error);
        // The headers have already been sent (200 OK), so we can't change
        // the status. The client will get a truncated JSON and fail to
        // parse — that's the best we can do mid-stream. The error is logged
        // server-side for debugging.
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tvtime-export-${userId}-${Date.now()}.json"`,
      "Cache-Control": "private, no-store",
      // Hint to the client that this is a large response — allows
      // progressive download indicators if the client implements them.
      "X-Export-Streamed": "true",
    },
  });
}
