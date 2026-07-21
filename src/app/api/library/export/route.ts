import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { normalizeMedia } from "@/lib/media-normalize";
import {
  LIBRARY_BACKUP_KIND,
  LIBRARY_BACKUP_VERSION,
  LIBRARY_COLLECTIONS,
  emptyCollectionCounts,
  isLibraryCollection,
  type LibraryCollection,
} from "@/lib/library-transfer-types";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 500;
const MAX_RESPONSE_RECORD_BYTES = 1_500_000;
const encoder = new TextEncoder();

type ExportRow = { cursor: string; data: unknown };

function jsonBytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

function fitRowsToBudget(rows: ExportRow[]) {
  const records: unknown[] = [];
  let bytes = 2;
  let lastCursor: string | null = null;

  for (const row of rows) {
    const rowBytes = jsonBytes(row.data) + (records.length > 0 ? 1 : 0);
    if (records.length > 0 && bytes + rowBytes > MAX_RESPONSE_RECORD_BYTES) break;
    if (records.length === 0 && rowBytes > MAX_RESPONSE_RECORD_BYTES) {
      return { records: [], lastCursor: null, bytes: rowBytes, oversized: true };
    }
    records.push(row.data);
    lastCursor = row.cursor;
    bytes += rowBytes;
  }

  return { records, lastCursor, bytes, oversized: false };
}

function sanitizeMedia(row: Record<string, unknown>) {
  const { id: _id, userId: _userId, updatedAt: _updatedAt, ...data } = normalizeMedia(row);
  return data;
}

function sanitizeUserOwnedRow(row: Record<string, unknown>) {
  const { id: _id, userId: _userId, ...data } = row;
  return data;
}

async function loadPage(
  collection: LibraryCollection,
  userId: string,
  cursor: string | null,
  limit: number,
): Promise<ExportRow[]> {
  const cursorWhere = cursor ? { id: { gt: cursor } } : {};

  if (collection === "media") {
    const rows = await db.media.findMany({
      where: { userId, ...cursorWhere },
      orderBy: { id: "asc" },
      take: limit,
    });
    return rows.map((row) => ({ cursor: row.id, data: sanitizeMedia(row) }));
  }

  if (collection === "watchedEpisodes") {
    const rows = await db.watchedEpisode.findMany({
      where: { userId, ...cursorWhere },
      orderBy: { id: "asc" },
      take: limit,
    });
    return rows.map((row) => ({ cursor: row.id, data: sanitizeUserOwnedRow(row) }));
  }

  const rows = await db.rating.findMany({
    where: {
      userId,
      mediaType: { startsWith: "episode:" },
      ...cursorWhere,
    },
    orderBy: { id: "asc" },
    take: limit,
  });
  return rows.map((row) => ({ cursor: row.id, data: sanitizeUserOwnedRow(row) }));
}

async function buildManifest(user: Awaited<ReturnType<typeof getOrCreateUser>>) {
  const [media, watchedEpisodes, episodeRatings] = await Promise.all([
    db.media.count({ where: { userId: user.id } }),
    db.watchedEpisode.count({ where: { userId: user.id } }),
    db.rating.count({ where: { userId: user.id, mediaType: { startsWith: "episode:" } } }),
  ]);
  const collections = { ...emptyCollectionCounts(), media, watchedEpisodes, episodeRatings };

  return {
    recordType: "manifest" as const,
    kind: LIBRARY_BACKUP_KIND,
    version: LIBRARY_BACKUP_VERSION,
    format: "ndjson" as const,
    app: "TvTime" as const,
    exportedAt: new Date().toISOString(),
    source: "Media+WatchedEpisode+Rating:episode-only",
    user: {
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
    },
    collections,
    totalRecords: media + watchedEpisodes + episodeRatings,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const url = new URL(req.url);
    const collectionValue = url.searchParams.get("collection");

    if (!collectionValue) {
      return NextResponse.json(await buildManifest(user), {
        headers: {
          "Cache-Control": "private, no-store",
          "X-TvTime-Backup-Version": String(LIBRARY_BACKUP_VERSION),
        },
      });
    }

    if (!isLibraryCollection(collectionValue)) {
      return NextResponse.json(
        { error: "Unsupported backup collection", allowedCollections: LIBRARY_COLLECTIONS },
        { status: 400 },
      );
    }

    const rawCursor = url.searchParams.get("cursor");
    const cursor = rawCursor && rawCursor.length <= 200 ? rawCursor : null;
    const requestedLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const rows = await loadPage(collectionValue, user.id, cursor, limit);
    const fitted = fitRowsToBudget(rows);
    if (fitted.oversized) {
      return NextResponse.json(
        {
          error: "One backup record is too large to transfer safely.",
          code: "EXPORT_RECORD_TOO_LARGE",
          maxRecordBytes: MAX_RESPONSE_RECORD_BYTES,
        },
        { status: 422 },
      );
    }

    const consumedAllFetchedRows = fitted.records.length === rows.length;
    const reachedEnd = consumedAllFetchedRows && rows.length < limit;
    const nextCursor = reachedEnd ? null : fitted.lastCursor;

    return NextResponse.json(
      {
        collection: collectionValue,
        records: fitted.records,
        nextCursor,
        recordCount: fitted.records.length,
        approximateBytes: fitted.bytes,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-TvTime-Backup-Version": String(LIBRARY_BACKUP_VERSION),
        },
      },
    );
  } catch (error) {
    console.error("[library:export]", error);
    return NextResponse.json({ error: "Failed to export library" }, { status: 500 });
  }
}
