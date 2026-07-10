import { PrismaClient } from "@prisma/client";
import fs from "fs";
import { compatibilityFieldsForState } from "../src/lib/media-state";

const db = new PrismaClient({ log: ["error"] });
const source = fs.readFileSync("scripts/add-finished-shows.ts", "utf-8");
const SHOWS = source.split("const SHOWS = [")[1].split("];", 1)[0].match(/"[^"]+"/g)?.map((value) => value.slice(1, -1)) || [];

async function main() {
  let fixed = 0;
  for (const title of SHOWS) {
    const rows = await db.media.findMany({ where: { title, type: "series" }, select: { id: true, watchedAt: true } });
    for (const row of rows) {
      await db.media.update({
        where: { id: row.id },
        data: compatibilityFieldsForState("completed", "series", { currentWatchedAt: row.watchedAt }),
      });
      fixed += 1;
    }
  }
  console.log(`Fixed: ${fixed}. Ratings were preserved and never synthesized.`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
