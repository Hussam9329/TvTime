import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { sessionId } = await params;
    const session = await (db as any).libraryImportSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: {
        id: true,
        status: true,
        expectedRecords: true,
        receivedRecords: true,
        expectedChunks: true,
        receivedChunks: true,
        preview: true,
        result: true,
        expiresAt: true,
        committedAt: true,
      },
    });
    if (!session) return NextResponse.json({ error: "Import session not found" }, { status: 404 });
    return NextResponse.json({ session });
  } catch (error) {
    console.error("[library:import:status]", error);
    return NextResponse.json({ error: "Failed to read import session" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { sessionId } = await params;
    const deleted = await (db as any).libraryImportSession.deleteMany({
      where: { id: sessionId, userId: user.id, status: { not: "committed" } },
    });
    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Import session was not found or is already committed" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, aborted: true });
  } catch (error) {
    console.error("[library:import:abort]", error);
    return NextResponse.json({ error: "Failed to cancel import" }, { status: 500 });
  }
}
