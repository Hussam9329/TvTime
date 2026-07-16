import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { getCanonicalLibraryCounts } from "@/lib/library-counts";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const counts = await getCanonicalLibraryCounts(user.id);
    return NextResponse.json({ counts, countsAreGlobal: true, source: "Media" });
  } catch (error) {
    console.error("[library:counts]", error);
    return NextResponse.json({ error: "Failed to load global library counts" }, { status: 500 });
  }
}
