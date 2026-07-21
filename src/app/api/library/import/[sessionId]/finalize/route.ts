import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { importFinalizeSchema } from "@/lib/library-import-validation";
import { emptyCollectionCounts, type LibraryCollection } from "@/lib/library-transfer-types";

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { sessionId } = await params;
    let parsed;
    try {
      parsed = importFinalizeSchema.parse(await req.json());
    } catch {
      return NextResponse.json(
        { error: "Invalid finalize request", code: "IMPORT_FINALIZE_INVALID" },
        { status: 400 },
      );
    }

    const sessions = (db as any).libraryImportSession;
    const chunksDelegate = (db as any).libraryImportChunk;
    const recordsDelegate = (db as any).libraryImportRecord;
    const session = await sessions.findFirst({ where: { id: sessionId, userId: user.id } });
    if (!session) return NextResponse.json({ error: "Import session not found" }, { status: 404 });
    if (session.expiresAt <= new Date()) return NextResponse.json({ error: "Import session expired" }, { status: 410 });
    if (!['uploading', 'ready'].includes(session.status)) {
      return NextResponse.json({ error: `Import session is ${session.status}` }, { status: 409 });
    }

    const chunks = await chunksDelegate.findMany({
      where: { sessionId },
      orderBy: { sequence: "asc" },
      select: { sequence: true, recordCount: true },
    });
    if (chunks.length !== parsed.expectedChunks) {
      return NextResponse.json(
        {
          error: "Not all chunks were uploaded",
          code: "IMPORT_CHUNKS_MISSING",
          receivedChunks: chunks.length,
          expectedChunks: parsed.expectedChunks,
        },
        { status: 409 },
      );
    }
    for (let sequence = 0; sequence < chunks.length; sequence++) {
      if (chunks[sequence].sequence !== sequence) {
        return NextResponse.json(
          { error: `Missing import chunk sequence ${sequence}`, code: "IMPORT_CHUNK_SEQUENCE_GAP" },
          { status: 409 },
        );
      }
    }

    const uploadedCount = chunks.reduce((sum: number, chunk: { recordCount: number }) => sum + chunk.recordCount, 0);
    if (uploadedCount !== parsed.expectedRecords
      || session.receivedRecords !== parsed.expectedRecords
      || session.expectedRecords !== parsed.expectedRecords) {
      return NextResponse.json(
        {
          error: "Uploaded record count does not match the manifest",
          code: "IMPORT_RECORD_COUNT_MISMATCH",
          manifestRecords: session.expectedRecords,
          uploadedRecords: uploadedCount,
          receivedRecords: session.receivedRecords,
        },
        { status: 409 },
      );
    }

    const grouped = await recordsDelegate.groupBy({
      by: ["collection"],
      where: { sessionId },
      _count: { _all: true },
    });
    const counts = emptyCollectionCounts();
    for (const row of grouped) {
      if (row.collection in counts) counts[row.collection as LibraryCollection] = row._count._all;
    }

    const manifest = session.manifest as {
      collections?: Partial<Record<LibraryCollection, number>>;
    };
    for (const collection of Object.keys(counts) as LibraryCollection[]) {
      const expected = Number(manifest.collections?.[collection] ?? 0);
      if (counts[collection] !== expected) {
        return NextResponse.json(
          {
            error: `Collection count mismatch for ${collection}`,
            code: "IMPORT_COLLECTION_COUNT_MISMATCH",
            collection,
            expected,
            received: counts[collection],
          },
          { status: 409 },
        );
      }
    }

    const [duplicateMedia, duplicateEpisodes, existingMedia, skippedSeriesRatings] = await Promise.all([
      db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COALESCE(SUM(grouped.count - 1), 0)::bigint AS count
        FROM (
          SELECT COUNT(*)::bigint AS count
          FROM "LibraryImportRecord"
          WHERE "sessionId" = ${sessionId}
            AND collection = 'media'
            AND NULLIF(payload->>'tmdbId', '') IS NOT NULL
          GROUP BY payload->>'type', payload->>'tmdbId'
          HAVING COUNT(*) > 1
        ) grouped
      `,
      db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COALESCE(SUM(grouped.count - 1), 0)::bigint AS count
        FROM (
          SELECT COUNT(*)::bigint AS count
          FROM "LibraryImportRecord"
          WHERE "sessionId" = ${sessionId} AND collection = 'watchedEpisodes'
          GROUP BY payload->>'showId', payload->>'seasonNumber', payload->>'episodeNumber'
          HAVING COUNT(*) > 1
        ) grouped
      `,
      db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "LibraryImportRecord" record
        JOIN "Media" media
          ON media."userId" = ${user.id}
         AND media.type = record.payload->>'type'
         AND media."tmdbId" = NULLIF(record.payload->>'tmdbId', '')::integer
        WHERE record."sessionId" = ${sessionId}
          AND record.collection = 'media'
          AND NULLIF(record.payload->>'tmdbId', '') IS NOT NULL
      `,
      db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "LibraryImportRecord"
        WHERE "sessionId" = ${sessionId}
          AND collection = 'media'
          AND COALESCE((payload->>'requestedSeriesRating')::boolean, false) = true
      `,
    ]);

    const preview = {
      counts,
      totalRecords: parsed.expectedRecords,
      duplicateRecordsThatWillMerge: {
        media: toNumber(duplicateMedia[0]?.count),
        watchedEpisodes: toNumber(duplicateEpisodes[0]?.count),
      },
      existingMediaThatWillMerge: toNumber(existingMedia[0]?.count),
      skippedWholeSeriesRatings: toNumber(skippedSeriesRatings[0]?.count),
      atomicCommit: true,
      warnings: toNumber(skippedSeriesRatings[0]?.count) > 0
        ? ["Whole-series ratings are skipped during restore until final completion can be verified again."]
        : [],
    };

    await sessions.update({
      where: { id: sessionId },
      data: {
        status: "ready",
        expectedChunks: parsed.expectedChunks,
        preview,
      },
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      preview,
      confirmationForCommit: `COMMIT:${sessionId}:${parsed.expectedRecords}`,
    });
  } catch (error) {
    console.error("[library:import:finalize]", error);
    return NextResponse.json({ error: "Failed to validate staged import" }, { status: 500 });
  }
}
