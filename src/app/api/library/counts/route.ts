import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { getCanonicalLibraryCounts } from "@/lib/library-counts";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const counts = await getCanonicalLibraryCounts(user.id);
    return NextResponse.json({ counts, countsAreGlobal: true, source: "Media" });
  } catch (error) {
    console.error("[library:counts]", error);
    return NextResponse.json({ error: "Failed to load global library counts" }, { status: 500 });
  }
}
