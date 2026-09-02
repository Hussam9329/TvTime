import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const rows = await db.filmSeries.findMany({
      where: { userId: user.id },
      orderBy: [{ name: "asc" }],
      include: {
        media: {
          where: { type: "movie" },
          orderBy: [{ seriesPart: "asc" }, { year: "asc" }, { title: "asc" }],
          select: {
            id: true,
            tmdbId: true,
            title: true,
            poster: true,
            year: true,
            watched: true,
            userRating: true,
            seriesPart: true,
          },
        },
      },
    });

    return NextResponse.json({
      items: rows.map((series) => ({
        id: series.id,
        tmdbCollectionId: series.tmdbCollectionId,
        name: series.name,
        posterPath: series.posterPath,
        totalParts: series.totalParts,
        libraryParts: series.media.length,
        watchedParts: series.media.filter((item) => item.watched).length,
        media: series.media,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[film-series]", error);
    return NextResponse.json({ error: "Failed to load film collections" }, { status: 500 });
  }
}
