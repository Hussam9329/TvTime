import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { importCommitSchema } from "@/lib/library-import-validation";
import { commitStagedLibraryImport } from "@/lib/library-import-commit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { sessionId } = await params;
    let parsed;
    try {
      parsed = importCommitSchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Commit confirmation is required" }, { status: 400 });
    }

    const session = await (db as any).libraryImportSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) return NextResponse.json({ error: "Import session not found" }, { status: 404 });
    const expectedConfirmation = `COMMIT:${sessionId}:${session.expectedRecords}`;
    if (parsed.confirm !== expectedConfirmation) {
      return NextResponse.json(
        { error: "Commit confirmation does not match the validated preview", code: "IMPORT_CONFIRMATION_MISMATCH" },
        { status: 409 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "LibraryImportSession"
        WHERE id = ${sessionId} AND "userId" = ${user.id}
        FOR UPDATE
      `;
      const sessions = (tx as any).libraryImportSession;
      const current = await sessions.findFirst({ where: { id: sessionId, userId: user.id } });
      if (!current) throw new Error("IMPORT_SESSION_NOT_FOUND");
      if (current.expiresAt <= new Date()) throw new Error("IMPORT_SESSION_EXPIRED");
      if (current.status === "committed") return current.result;
      if (current.status !== "ready") throw new Error(`IMPORT_SESSION_NOT_READY:${current.status}`);

      await sessions.update({ where: { id: sessionId }, data: { status: "committing" } });
      const committed = await commitStagedLibraryImport(tx, sessionId, user.id);
      const resultPayload = {
        ...committed,
        stagedRecords: current.expectedRecords,
        committedAt: new Date().toISOString(),
      };

      await (tx as any).libraryImportRecord.deleteMany({ where: { sessionId } });
      await (tx as any).libraryImportChunk.deleteMany({ where: { sessionId } });
      await sessions.update({
        where: { id: sessionId },
        data: {
          status: "committed",
          committedAt: new Date(),
          result: resultPayload,
        },
      });
      return resultPayload;
    }, { maxWait: 10_000, timeout: 120_000 });

    return NextResponse.json({ ok: true, sessionId, imported: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "IMPORT_SESSION_EXPIRED") {
      return NextResponse.json({ error: "Import session expired" }, { status: 410 });
    }
    if (message.startsWith("IMPORT_SESSION_NOT_READY")) {
      return NextResponse.json({ error: "Import session is not ready to commit" }, { status: 409 });
    }
    if (message === "IMPORT_SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "Import session not found" }, { status: 404 });
    }
    console.error("[library:import:commit]", error);
    return NextResponse.json(
      { error: "Atomic import failed; no library changes were committed", code: "IMPORT_COMMIT_FAILED" },
      { status: 500 },
    );
  }
}
