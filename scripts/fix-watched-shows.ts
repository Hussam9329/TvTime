import { PrismaClient } from "@prisma/client";
import { compatibilityFieldsForState } from "../src/lib/media-state";

const db = new PrismaClient({ log: ["error"] });

async function main() {
  console.log("[START] Repairing fully watched shows using canonical state...");
  const series = await db.media.findMany({
    where: {
      type: "series",
      libraryState: { in: ["planned", "watching", "up_to_date"] },
      tmdbId: { not: null },
    },
    select: { id: true, userId: true, tmdbId: true, title: true, episodes: true, watchedAt: true },
  });

  let fixed = 0;
  for (const show of series) {
    if (!show.tmdbId || !show.episodes) continue;
    const watchedCount = await db.watchedEpisode.count({
      where: { userId: show.userId, showId: show.tmdbId },
    });
    if (watchedCount < show.episodes) continue;

    await db.media.update({
      where: { id: show.id },
      data: compatibilityFieldsForState("completed", "series", { currentWatchedAt: show.watchedAt }),
    });
    console.log(`  Fixed: ${show.title} (${watchedCount}/${show.episodes} episodes)`);
    fixed += 1;
  }

  console.log(`\n[DONE] Fixed ${fixed} show(s). Ratings were not created or changed.`);
}

main().catch((error) => {
  console.error("[ERROR]", error);
  process.exit(1);
}).finally(async () => db.$disconnect());
