import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// TVM-39: Protected Clear Library — requires explicit confirmation token.
// The client must send a confirm header with the exact string "DELETE EVERYTHING"
// to prevent accidental data loss. Without it, the request is rejected with 409.

export async function DELETE(req: NextRequest) {
  try {
    // TVM-39: Require explicit confirmation header
    const confirm = req.headers.get("x-confirm-delete");
    if (confirm !== "DELETE EVERYTHING") {
      return NextResponse.json(
        {
          error: "Confirmation required. Send header 'x-confirm-delete: DELETE EVERYTHING' to confirm.",
          code: "CONFIRMATION_REQUIRED",
          hint: "This endpoint deletes ALL your library data. Add the confirmation header to proceed.",
        },
        { status: 409 },
      );
    }

    const user = await getOrCreateUser(parseUserId(req));
    const [media, watchedEpisodes, episodeRatings] = await db.$transaction([
      db.media.deleteMany({ where: { userId: user.id } }),
      db.watchedEpisode.deleteMany({ where: { userId: user.id } }),
      db.rating.deleteMany({ where: { userId: user.id, mediaType: { startsWith: "episode:" } } }),
    ]);
    return NextResponse.json({
      ok: true,
      deleted: { media: media.count, watchedEpisodes: watchedEpisodes.count, episodeRatings: episodeRatings.count },
      source: "Media+WatchedEpisode+Rating:episode-only",
    });
  } catch (error) {
    console.error("[library:clear]", error);
    return NextResponse.json({ error: "Failed to clear library" }, { status: 500 });
  }
}
