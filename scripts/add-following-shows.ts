// Add TV shows as following (not started, no episodes watched)
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });
const TMDB_API_KEY = "8265bd1679663a7ea12ac168da84d2e8";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

// Known anime titles from the list
const ANIME_TITLES = [
  "elfen lied","fairy tail","my hero academia","parasyte","the end of the f***ing world"
];

function isAnime(title: string): boolean {
  const lower = title.toLowerCase();
  return ANIME_TITLES.some(k => lower.includes(k));
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function searchTvShow(title: string): Promise<any | null> {
  const cleanTitle = title.replace(/\(.*?\)/g, '').replace(/:.*/g, '').trim();
  const url = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}&include_adult=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results?.length > 0) return data.results[0];
    // Try full title
    if (cleanTitle !== title) {
      const url2 = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=true`;
      const res2 = await fetch(url2);
      if (!res2.ok) return null;
      const data2 = await res2.json();
      if (data2.results?.length > 0) return data2.results[0];
    }
    return null;
  } catch { return null; }
}

async function getShowDetails(tmdbId: number): Promise<any | null> {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

const SHOWS = [
  "Anne with an E","Baby Reindeer","Big Little Lies","Big Love","Black Sails",
  "Blindspot","Bloodline","Bob's Burgers","Bodyguard","Broadchurch",
  "Call the Midwife","Carnival Row","Catherine the Great","Cloak & Dagger",
  "Collateral","Creepshow","Dark Matter","Disenchantment","Doctor Foster",
  "Doom Patrol","Drops of God","Elite","Elfen Lied","F is for Family",
  "Fairy Tail","Full House","Future Man","Gilmore Girls","Glitch",
  "Godfather of Harlem","Good Omens","Grace and Frankie","Hannibal",
  "Hell on Wheels","Hemlock Grove","High School DxD","Into the Night",
  "Jack Ryan","Jonathan Strange & Mr Norrell","Justified","Kalifat",
  "Last Man Standing","Life in Pieces","Lucifer","Mindhunter","Maniac",
  "Master of None","Masters of Horror","Me, Myself & I","Melissa & Joey",
  "Modern Family","Misfits","Mom","Mr Selfridge","Mr. Mercedes",
  "Murder in the Bayou","My Hero Academia","Nine Perfect Strangers",
  "Orange Is the New Black","Outlander","Parasyte","Penny Dreadful",
  "Presumed Innocent","Raising Dion","Roseanne","Salvation","Sanctuary",
  "Scream","Shameless","Sharp Objects","Six","Stumptown","Suburra",
  "Taboo","The Affair","The Alienist","The End of the F***ing World",
  "The Exes","The Fall","The Fosters","The Gilded Age","The Good Place",
  "The Good Wife","The Handmaid's Tale","The Hollow Crown","The Middle",
  "The Mist","The Night Agent","The O.C.","The Pretender","The Rain",
  "The Ranch","The Secret Life of the American Teenager","The Sopranos",
  "The Strain","The Stranger","The Terror","The Unicorn","The Witcher",
  "Tin Star","Twin Peaks","Victoria","Vikings","Vis a vis","Wentworth",
  "You","Young Royals"
];

async function main() {
  console.log(`[START] Adding ${SHOWS.length} shows as following...`);
  let added = 0, updated = 0, notFound = 0;

  for (let i = 0; i < SHOWS.length; i++) {
    const title = SHOWS[i];
    const anime = isAnime(title);

    try {
      const result = await searchTvShow(title);
      if (!result) {
        console.log(`  [${i+1}/${SHOWS.length}] NOT FOUND: ${title}`);
        notFound++;
        continue;
      }

      const tmdbId = result.id;
      const poster = result.poster_path ? `${TMDB_IMG}${result.poster_path}` : null;
      const year = result.first_air_date ? result.first_air_date.slice(0, 4) : null;
      const overview = result.overview || null;
      const rating = result.vote_average ? String(result.vote_average) : null;

      const details = await getShowDetails(tmdbId);
      const totalEpisodes = details?.number_of_episodes || null;
      const seasons = details?.number_of_seasons || null;
      const status = details?.status || null;
      const genres = details?.genres?.map((g: any) => g.name) || [];

      const existing = await db.media.findFirst({ where: { tmdbId } });

      if (existing) {
        // Update as following (planned) - DON'T overwrite if already watched
        if (!existing.watched) {
          await db.media.update({
            where: { id: existing.id },
            data: {
              status: "planned",
              watched: false,
              isAnime: anime || existing.isAnime,
              poster: poster || existing.poster,
              overview: overview || existing.overview,
              rating: rating || existing.rating,
              episodes: totalEpisodes || existing.episodes,
              seasons: seasons || existing.seasons,
              genres: genres.length > 0 ? genres : existing.genres,
            },
          });
          updated++;
        }
      } else {
        const id = `tmdb_${tmdbId}_following`;
        await db.media.create({
          data: {
            id, tmdbId, title, type: "series",
            poster, year, overview, rating, genres,
            episodes: totalEpisodes, seasons,
            status: "planned",
            watched: false,
            isAnime: anime,
            tags: ["following"],
          },
        });
        added++;
      }

      if ((i + 1) % 10 === 0 || i === SHOWS.length - 1) {
        console.log(`  [${i+1}/${SHOWS.length}] Added: ${added} | Updated: ${updated} | Not found: ${notFound} | Last: ${title}`);
      }
    } catch (e) {
      console.error(`  ERROR: ${title} - ${e instanceof Error ? e.message : e}`);
      notFound++;
    }
    if ((i + 1) % 5 === 0) await sleep(200);
  }

  console.log(`\n[DONE] Added: ${added} | Updated: ${updated} | Not found: ${notFound}`);
}

main()
  .catch((e) => { console.error("[ERROR]", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
