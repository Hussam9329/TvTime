import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// Helper: Check if a show is fully watched and auto-move to Finished
async function autoUpdateShowStatus(userId: string, showTmdbId: number) {
  try {
    // Find the Media record for this show
    const media = await db.media.findFirst({
      where: { userId, tmdbId: showTmdbId, type: "series" },
    });
    if (!media) return;

    // Count watched episodes for this show
    const watchedCount = await db.watchedEpisode.count({
      where: { userId, showId: showTmdbId },
    });

    // Get total episodes from TMDB via the Media record
    const totalEpisodes = media.episodes || 0;

    if (totalEpisodes > 0 && watchedCount >= totalEpisodes) {
      // Show is fully watched! Move to Finished
      if (!media.watched || media.status !== "watched") {
        await db.media.update({
          where: { id: media.id },
          data: {
            watched: true,
            status: "watched",
            watchedAt: new Date(),
            userRating: media.userRating ?? 75, // default rating if not set
          },
        });
      }
    } else if (watchedCount > 0 && (media.status === "planned" || media.status === null) && !media.watched) {
      // Show has some episodes watched but not all - keep in watchlist but could mark as "in progress"
      // Don't change status - it stays in watchlist until fully watched
    } else if (watchedCount === 0 && media.watched) {
      // All episodes unwatched - move back to watchlist
      await db.media.update({
        where: { id: media.id },
        data: {
          watched: false,
          status: "planned",
          userRating: null,
          watchedAt: null,
        },
      });
    }
  } catch (error) {
    console.error("[autoUpdateShowStatus]", error);
  }
}

// GET - list watched episodes (optionally filter by showId)
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const showId = url.searchParams.get("showId");

    const items = await db.watchedEpisode.findMany({
      where: {
        userId: user.id,
        ...(showId ? { showId: Number(showId) } : {}),
      },
      orderBy: { watchedAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[watched-episodes:GET]", error);
    return NextResponse.json({ error: "Failed to load episodes" }, { status: 500 });
  }
}

// POST - mark episode as watched (supports bulk via episodes array)
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();

    // Bulk mode
    if (Array.isArray(body.episodes)) {
      const showId = Number(body.showId);
      if (!showId) return NextResponse.json({ error: "showId required for bulk" }, { status: 400 });

      const data = body.episodes.map((e: { seasonNumber: number; episodeNumber: number; episodeName?: string }) => ({
        userId: user.id,
        showId,
        seasonNumber: Number(e.seasonNumber),
        episodeNumber: Number(e.episodeNumber),
        episodeName: e.episodeName || null,
      }));

      // Upsert each
      await Promise.all(
        data.map((d: any) =>
          db.watchedEpisode.upsert({
            where: {
              userId_showId_seasonNumber_episodeNumber: {
                userId: d.userId,
                showId: d.showId,
                seasonNumber: d.seasonNumber,
                episodeNumber: d.episodeNumber,
              },
            },
            create: d,
            update: { episodeName: d.episodeName },
          })
        )
      );

      // Auto-update show status (check if fully watched)
      await autoUpdateShowStatus(user.id, showId);

      return NextResponse.json({ ok: true, count: data.length });
    }

    // Single mode
    const { showId, seasonNumber, episodeNumber, episodeName } = body;
    if (!showId || seasonNumber == null || episodeNumber == null) {
      return NextResponse.json({ error: "showId, seasonNumber, episodeNumber required" }, { status: 400 });
    }

    const item = await db.watchedEpisode.upsert({
      where: {
        userId_showId_seasonNumber_episodeNumber: {
          userId: user.id,
          showId: Number(showId),
          seasonNumber: Number(seasonNumber),
          episodeNumber: Number(episodeNumber),
        },
      },
      create: {
        userId: user.id,
        showId: Number(showId),
        seasonNumber: Number(seasonNumber),
        episodeNumber: Number(episodeNumber),
        episodeName: episodeName || null,
      },
      update: {},
    });

    // Auto-update show status (check if fully watched)
    await autoUpdateShowStatus(user.id, Number(showId));

    return NextResponse.json({ item });
  } catch (error) {
    console.error("[watched-episodes:POST]", error);
    return NextResponse.json({ error: "Failed to mark episode" }, { status: 500 });
  }
}

// DELETE - remove watched episode
export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const showId = url.searchParams.get("showId");
    const seasonNumber = url.searchParams.get("seasonNumber");
    const episodeNumber = url.searchParams.get("episodeNumber");

    if (!showId || seasonNumber == null || episodeNumber == null) {
      return NextResponse.json({ error: "showId, seasonNumber, episodeNumber required" }, { status: 400 });
    }

    await db.watchedEpisode.deleteMany({
      where: {
        userId: user.id,
        showId: Number(showId),
        seasonNumber: Number(seasonNumber),
        episodeNumber: Number(episodeNumber),
      },
    });

    // Auto-update show status (might need to move back to watchlist)
    await autoUpdateShowStatus(user.id, Number(showId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[watched-episodes:DELETE]", error);
    return NextResponse.json({ error: "Failed to unmark episode" }, { status: 500 });
  }
}
