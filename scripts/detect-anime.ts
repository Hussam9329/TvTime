// Detect and mark anime/animation series in the database
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });
const TMDB_API_KEY = "8265bd1679663a7ea12ac168da84d2e8";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// Additional anime titles to mark (Japanese animation that might not have "Animation" genre)
const KNOWN_ANIME_TITLES = [
  "attack on titan","death note","code geass","tokyo ghoul","charlotte","citrus","erased",
  "seraph of the end","shomin sample","terra formars","terror in resonance","the seven deadly sins",
  "the wallflower","yamato nadeshiko","aoi bungaku","aoki densetsu","bomberman jetters",
  "cooking papa","doraemon","digimon adventure","future boy conan","hello sandybell","high school dxd",
  "joker game","kill me heal me","kimi ni todoke","kokoro connect","mazinger z","megalobox",
  "mitsudomoe","muka muka","muteki kanban","my daddy long legs","nadia","olive et tom",
  "relife","remi","ristorante paradiso","romance of the three kingdoms","sangokushi",
  "slam dunk","sonic the series","spy x family","super electromagnetic","combattler",
  "overlord","b: the beginning","primal","babar","baby and me","animaniacs",
  "batman: the animated series","police academy","popeye","pinky and the brain",
  "taz-mania","tom and jerry","totally spies","the woody woodpecker","the powerpuff girls",
  "the mask","the magic school bus","the sylvester","simba","sinbad","sindbad",
  "sonic","spider-noir","sailor moon","naruto","one piece","bleach","dragon ball",
  "demon slayer","jujutsu kaisen","my hero academia","hunter x hunter","fullmetal",
  "cowboy bebop","one punch man","mob psycho","vinland saga","chainsaw man",
  "attack on titan","a gifted man"
];

function isKnownAnime(title: string): boolean {
  const lower = title.toLowerCase();
  return KNOWN_ANIME_TITLES.some(k => lower.includes(k));
}

async function getShowDetails(tmdbId: number): Promise<any | null> {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  console.log("[START] Detecting anime series...");
  
  // Get all series with tmdbId
  const series = await db.media.findMany({
    where: { type: "series", tmdbId: { not: null } },
    select: { id: true, tmdbId: true, title: true, isAnime: true, genresJson: true },
  });
  console.log(`[INFO] Found ${series.length} series to check`);

  let markedAnime = 0;
  let markedNonAnime = 0;
  let checked = 0;
  const batchSize = 10;

  for (let i = 0; i < series.length; i += batchSize) {
    const batch = series.slice(i, i + batchSize);
    
    await Promise.allSettled(batch.map(async (s) => {
      if (!s.tmdbId) return;
      
      // First check by known title
      let isAnime = isKnownAnime(s.title);
      
      // If not detected by title, check TMDB genres
      if (!isAnime) {
        const details = await getShowDetails(s.tmdbId);
        if (details) {
          const genreNames = details.genres?.map((g: any) => g.name.toLowerCase()) || [];
          const originCountry = details.origin_country || [];
          
          // Mark as anime if has "Animation" genre AND from Japan
          // OR if it's a Japanese show with "Animation" genre
          if (genreNames.includes("animation") && originCountry.includes("JP")) {
            isAnime = true;
          }
          // Also check for "Anime" genre specifically
          if (genreNames.includes("anime")) {
            isAnime = true;
          }
          
          // Update genres if empty
          if ((!s.genresJson || s.genresJson === "[]") && details.genres) {
            await db.media.update({
              where: { id: s.id },
              data: { 
                genresJson: JSON.stringify(details.genres.map((g: any) => g.name)),
                isAnime 
              },
            });
          } else if (s.isAnime !== isAnime) {
            await db.media.update({
              where: { id: s.id },
              data: { isAnime },
            });
          }
        }
      } else {
        // Known anime - just update isAnime if different
        if (!s.isAnime) {
          await db.media.update({
            where: { id: s.id },
            data: { isAnime: true },
          });
        }
      }
      
      if (isAnime) markedAnime++;
      else markedNonAnime++;
    }));

    checked += batch.length;
    if (checked % 50 === 0 || checked >= series.length) {
      console.log(`  Progress: ${checked}/${series.length} | Anime: ${markedAnime} | Non-anime: ${markedNonAnime}`);
    }
    await sleep(300);
  }

  console.log(`\n[DONE] Checked: ${checked} | Anime: ${markedAnime} | Non-anime: ${markedNonAnime}`);
  
  // Final count
  const totalAnime = await db.media.count({ where: { type: "series", isAnime: true } });
  const totalNonAnime = await db.media.count({ where: { type: "series", isAnime: false } });
  console.log(`Final: Anime=${totalAnime}, Non-anime=${totalNonAnime}`);
}

main()
  .catch((e) => { console.error("[ERROR]", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
