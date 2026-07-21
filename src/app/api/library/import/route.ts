import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { importStartSchema } from "@/lib/library-import-validation";

export const dynamic = "force-dynamic";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 3;

function validationError(error: unknown) {
  const issues = typeof error === "object" && error && "issues" in error
    ? (error as { issues?: Array<{ path?: Array<string | number>; message?: string }> }).issues
    : null;
  return NextResponse.json(
    {
      error: "Invalid import manifest",
      code: "IMPORT_MANIFEST_INVALID",
      issues: issues?.slice(0, 20).map((issue) => ({ path: issue.path, message: issue.message })),
    },
    { status: 400 },
  );
}

/** Start a staged version-5 import. No library rows are changed here. */
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    let parsed;
    try {
      parsed = importStartSchema.parse(await req.json());
    } catch (error) {
      return validationError(error);
    }

    const expectedFromCollections = Object.values(parsed.manifest.collections as Record<string, number>)
      .reduce((sum: number, count: number) => sum + count, 0);
    if (expectedFromCollections !== parsed.manifest.totalRecords) {
      return NextResponse.json(
        { error: "Manifest collection counts do not match totalRecords", code: "IMPORT_MANIFEST_COUNT_MISMATCH" },
        { status: 400 },
      );
    }

    const sessions = (db as any).libraryImportSession;
    await sessions.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() }, status: { not: "committed" } },
    });
    const active = await sessions.count({
      where: { userId: user.id, status: { in: ["uploading", "ready"] }, expiresAt: { gt: new Date() } },
    });
    if (active >= MAX_ACTIVE_SESSIONS) {
      return NextResponse.json(
        { error: "Too many active import sessions. Cancel an older import first.", code: "IMPORT_SESSION_LIMIT" },
        { status: 409 },
      );
    }

    const session = await sessions.create({
      data: {
        userId: user.id,
        version: parsed.manifest.version,
        status: "uploading",
        manifest: parsed.manifest,
        expectedRecords: parsed.manifest.totalRecords,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
      select: { id: true, expectedRecords: true, expiresAt: true },
    });

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      expectedRecords: session.expectedRecords,
      expiresAt: session.expiresAt,
      uploadUrl: `/api/library/import/${session.id}/chunks`,
      finalizeUrl: `/api/library/import/${session.id}/finalize`,
      commitUrl: `/api/library/import/${session.id}/commit`,
    }, { status: 201 });
  } catch (error) {
    console.error("[library:import:start]", error);
    return NextResponse.json({ error: "Failed to start import" }, { status: 500 });
  }
}
