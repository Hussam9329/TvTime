import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { importChunkSchema, normalizeImportRecord, type NormalizedImportRecord } from "@/lib/library-import-validation";
import {
  LIBRARY_IMPORT_MAX_CHUNK_BYTES,
  LIBRARY_IMPORT_MAX_CHUNK_RECORDS,
} from "@/lib/library-transfer-types";

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { sessionId } = await params;
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > LIBRARY_IMPORT_MAX_CHUNK_BYTES) {
      return NextResponse.json(
        { error: "Import chunk is too large", code: "IMPORT_CHUNK_TOO_LARGE" },
        { status: 413 },
      );
    }

    let parsed;
    try {
      const body = await req.json();
      if (Buffer.byteLength(JSON.stringify(body), "utf8") > LIBRARY_IMPORT_MAX_CHUNK_BYTES) {
        return NextResponse.json(
          { error: "Import chunk is too large", code: "IMPORT_CHUNK_TOO_LARGE" },
          { status: 413 },
        );
      }
      parsed = importChunkSchema.parse(body);
    } catch (error) {
      const issues = typeof error === "object" && error && "issues" in error
        ? (error as { issues?: unknown[] }).issues
        : undefined;
      return NextResponse.json(
        { error: "Invalid import chunk", code: "IMPORT_CHUNK_INVALID", issues },
        { status: 422 },
      );
    }

    if (parsed.records.length > LIBRARY_IMPORT_MAX_CHUNK_RECORDS) {
      return NextResponse.json({ error: "Too many records in chunk" }, { status: 413 });
    }
    if (checksum(parsed.records) !== parsed.checksum) {
      return NextResponse.json(
        { error: "Import chunk checksum mismatch", code: "IMPORT_CHUNK_CHECKSUM_MISMATCH" },
        { status: 400 },
      );
    }

    const normalized: NormalizedImportRecord[] = [];
    const errors: Array<{ index: number; message: string }> = [];
    for (let index = 0; index < parsed.records.length; index++) {
      try {
        normalized.push(normalizeImportRecord(parsed.records[index]));
      } catch (error) {
        errors.push({ index, message: error instanceof Error ? error.message : "Invalid record" });
        if (errors.length >= 20) break;
      }
    }
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Chunk validation failed; no records were staged", code: "IMPORT_RECORD_INVALID", errors },
        { status: 422 },
      );
    }

    const seenOrdinals = new Set<string>();
    for (const record of normalized) {
      const key = `${record.collection}:${record.ordinal}`;
      if (seenOrdinals.has(key)) {
        return NextResponse.json(
          { error: `Duplicate record ordinal in chunk: ${key}`, code: "IMPORT_DUPLICATE_ORDINAL" },
          { status: 409 },
        );
      }
      seenOrdinals.add(key);
    }

    const outcome = await db.$transaction(async (tx) => {
      const sessions = (tx as any).libraryImportSession;
      const chunks = (tx as any).libraryImportChunk;
      const records = (tx as any).libraryImportRecord;
      await tx.$queryRaw`
        SELECT id FROM "LibraryImportSession"
        WHERE id = ${sessionId} AND "userId" = ${user.id}
        FOR UPDATE
      `;
      const session = await sessions.findFirst({ where: { id: sessionId, userId: user.id } });
      if (!session) return { status: 404 as const, payload: { error: "Import session not found" } };
      if (session.expiresAt <= new Date()) return { status: 410 as const, payload: { error: "Import session expired" } };
      if (session.status !== "uploading") {
        return { status: 409 as const, payload: { error: `Import session is ${session.status}` } };
      }

      const existing = await chunks.findUnique({
        where: { sessionId_sequence: { sessionId, sequence: parsed.sequence } },
      });
      if (existing) {
        if (existing.checksum === parsed.checksum) {
          return {
            status: 200 as const,
            payload: { ok: true, duplicate: true, sequence: parsed.sequence, accepted: existing.recordCount },
          };
        }
        return {
          status: 409 as const,
          payload: { error: "Sequence already uploaded with a different checksum", code: "IMPORT_SEQUENCE_CONFLICT" },
        };
      }

      if (session.receivedRecords + normalized.length > session.expectedRecords) {
        return {
          status: 409 as const,
          payload: { error: "Uploaded records exceed manifest total", code: "IMPORT_RECORD_OVERFLOW" },
        };
      }

      await chunks.create({
        data: {
          sessionId,
          sequence: parsed.sequence,
          checksum: parsed.checksum,
          recordCount: normalized.length,
        },
      });
      await records.createMany({
        data: normalized.map((record) => ({
          id: randomUUID(),
          sessionId,
          collection: record.collection,
          ordinal: record.ordinal,
          payload: record.payload,
        })),
      });
      const updated = await sessions.update({
        where: { id: sessionId },
        data: {
          receivedRecords: { increment: normalized.length },
          receivedChunks: { increment: 1 },
        },
        select: { receivedRecords: true, expectedRecords: true },
      });
      return {
        status: 201 as const,
        payload: {
          ok: true,
          duplicate: false,
          sequence: parsed.sequence,
          accepted: normalized.length,
          receivedRecords: updated.receivedRecords,
          expectedRecords: updated.expectedRecords,
        },
      };
    });

    return NextResponse.json(outcome.payload, { status: outcome.status });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A record ordinal was already uploaded in another chunk", code: "IMPORT_ORDINAL_CONFLICT" },
        { status: 409 },
      );
    }
    console.error("[library:import:chunk]", error);
    return NextResponse.json({ error: "Failed to stage import chunk" }, { status: 500 });
  }
}
