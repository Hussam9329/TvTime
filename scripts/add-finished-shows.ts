// Add TV shows as finished/watched to Neon database
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });
const TMDB_API_KEY = "8265bd1679663a7ea12ac168da84d2e8";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

const SHOWS = [
  "A Gifted Man","A Little Princess Sara","A Series of Unfortunate Events","According to Jim",
  "Agatha All Along","Agatha Christie's Great Detectives Poirot and Marple","Alcatraz",
  "Alfred Hitchcock Presents","Alias","Aliens in America","All Her Fault","Alphas",
  "Amazing Stories","American Dad!","And Then There Were None","Angel","Anger Management",
  "Animaniacs","Aoi Bungaku Series","Aoki Densetsu Shoot!","Archer","Arrow","Attack on Titan",
  "Awake","Awkward.","B: The Beginning","Babar","Baby and Me","Baby Daddy","Band of Brothers",
  "Banshee","Baskets","Bates Motel","Batman: The Animated Series","Battlestar Galactica",
  "Battlestar Galactica: The Miniseries","Beauty & the Beast","Becker","Being Human","Betrayal",
  "Better Call Saul","Bionic Woman","Boardwalk Empire","Bodies","Body of Proof","BoJack Horseman",
  "Bomberman Jetters","Bored to Death","Boston Legal","Breaking Bad","Britain's Got Talent",
  "Brooklyn Nine-Nine","Brothers & Sisters","Buffy the Vampire Slayer","Californication",
  "Camelot","Castle","Catch-22","Charlotte","Charmed","Cheers","Chernobyl","Citrus","Code Geass",
  "Colony","Constantine","Continuum","Cooking Papa","Cougar Town","Criminal Minds: Suspect Behavior",
  "Crisis","Crossing Lines","Crowded","Da Vinci's Demons","Dads","Damages","Dark",
  "DC's Legends of Tomorrow","Death Note","Defending Jacob","Defiance","Designated Survivor",
  "Desperate Housewives","Devious Maids","Dexter","Die Hart","Digimon Adventure","Disclaimer",
  "Doctor Who","Dollhouse","Dominion","Doraemon","Doubt","Downton Abbey","Dr. Ken","Drake & Josh",
  "Dynasties II","Early Edition","Echo","Electric Dreams","Episodes","Erased","Eureka",
  "Everybody Loves Raymond","Extant","Falling Skies","Fargo","Fear Itself","Fear the Walking Dead",
  "Feed the Beast","Flashforward","Flashpoint","Forever","Frasier","Friends",
  "Friends with Better Lives","Fringe","From","From Dusk Till Dawn: The Series","Future Boy Conan",
  "Game of Thrones","Gangland Undercover","Ghost Whisperer","Girls","Glee","Go On","Goliath",
  "Gossip Girl","Gotham","Gracepoint","Grandfathered","Greek","Grey's Anatomy","Grounded for Life",
  "GTO (Great Teacher Onizuka)","Hannah Montana","Hannibal","Happiness","Happy Endings",
  "Hart of Dixie","Haven","Hawaii Five-0","Hawkeye","Helix","Hellbound","Hello! Sandybell",
  "Heroes","Heroes Reborn","High School DxD","Homeland","Hope & Faith","Hostages","Houdini",
  "House","House of Cards","House of Saddam","How I Met Your Mother","How to Become a Tyrant",
  "How to Get Away with Murder","Human Target","Humans","Hunted","I Am Groot",
  "I Hate My Teenage Daughter","I Know This Much Is True","iCarly","Impastor","Inhumans",
  "Into the Badlands","Into the Dark","Iron Fist","Jericho","Jessica Jones","Joey","Joker Game",
  "Journeyman","Kevin Can Wait","Kill Me Heal Me","Kimi ni Todoke","Kokoro Connect","Kyle XY",
  "Legend of the Seeker","Legends","Legion","Les Misérables","Leverage","Lie to me","Life",
  "Living with Yourself","Loki","Longmire","Lost","Lost in Space","Love","Luke Cage","Mad Love",
  "Mad Men","Man Up!","Man vs Bee","Man with a Plan","Manifest","Married with Children",
  "Marvel's Agent Carter","Marvel's Agents of S.H.I.E.L.D.","Marvel's Daredevil","Mazinger Z",
  "Megalobox","Men Behaving Badly","Merlin","Mind Your Language","Mistresses","Mitsudomoe",
  "Modern Family","Money Heist (La Casa de Papel)","Moon Knight","Moonlight","Most Dangerous Game",
  "Mouse","Mr. Bean","Mr. Robot","Mr. Sunshine","Ms. Marvel","Muka Muka Paradise",
  "Muteki Kanban Musume","My Daddy Long Legs","My Name is Earl","My Own Worst Enemy",
  "Nadia: The Secret of Blue Water","Narcos","Nature's Great Events","NCIS","New Girl","Nikita",
  "No Ordinary Family","NOS4A2","Olive et Tom","Once Upon a Time",
  "Once Upon a Time in Wonderland","One Tree Hill","Ordeal by Innocence","Orphan Black","Overlord",
  "Oz","Ozark","Pan Am","Parenthood","Partners","Patrick Melrose","Peaky Blinders","Perception",
  "Person of Interest","Persons Unknown","Pinky and the Brain","Pokémon","Poldark",
  "Police Academy: The Animated Series","Popeye the Sailor","Powerless","Powers","Preacher",
  "Pretty Little Liars","Primal","Primeval: New World","Prison Break","Ray Donovan","Reaper",
  "Reign","ReLIFE","Remi, Nobody's Girl","Resurrection","Revenge","Revolution","Ringer","Ripley",
  "Ristorante Paradiso","Rob","Robin Hood","Romance of the Three Kingdoms (Sangokushi)","Rome",
  "Roommates","Roots","Rules of Engagement","Sabrina the Teenage Witch","Sad Love Story","Salem",
  "Sausage Party: Foodtopia","Saving Hope","Scrubs","Sean Saves the World","Second Chance",
  "Secret Diary of a Call Girl","Secret Invasion","Secrets and Lies","See","Seinfeld",
  "Seraph of the End","She-Hulk: Attorney at Law","Sherlock","Shomin Sample","Simba: The King Lion",
  "Sinbad","Sindbad","Skins","Slam Dunk","Slasher","Sleepy Hollow","Smallville","Snowpiercer",
  "Solar Opposites","Sonic The Series","Sons of Anarchy","Spartacus","Spider-Noir","Spy x Family",
  "Squid Game","SS-GB","Stalker","Star-Crossed","State of the Union","Strike Back","Suburgatory",
  "Suits","Super Electromagnetic Robot Combattler V","Supergirl","Supernatural",
  "Supernatural: The Animation","Survive","Switched","Switched at Birth","Talking Dead",
  "Taz-Mania","Teen Wolf","Teletubbies","Terminator: The Sarah Connor Chronicles","Terra Formars",
  "Terra Nova","Terror in Resonance","That '70s Show","The 100","The 4400","The Act","The Americans",
  "The Big Bang Theory","The Blacklist","The Booth at the End","The Borgias","The Boys","The Bridge",
  "The Carrie Diaries","The Confession","The Crown","The Dead Zone","The Defenders","The Detour",
  "The Devil's Hour","The Driver","The Event","The Falcon and the Winter Soldier",
  "The Fall of the House of Usher","The Flash","The Following","The Gates","The Goldbergs",
  "The Haunting","The I-Land","The IT Crowd","The Kennedys","The Kill Point","The Killing",
  "The King of Queens","The Knick","The Last Man on Earth","The Last Ship","The Leftovers",
  "The Lost Room","The Lying Game","The Magic School Bus","The Man in the High Castle",
  "The Mask: Animated Series","The Midwich Cuckoos","The Millers","The Missing","The Neighbors",
  "The Newsroom","The Night Of","The Nine Lives of Chloe King","The OA","The Odd Couple","The Office",
  "The Originals","The Outsider","The Path","The Penguin","The Powerpuff Girls","The Prisoner",
  "The Punisher","The Purge","The Queen's Gambit","The Returned","The River","The Secret",
  "The Secret Circle","The Seven Deadly Sins","The Sinner","The Story of God",
  "The Sylvester & Tweety Mysteries","The Tomorrow People","The Triangle","The Tudors",
  "The Twilight Zone","The Undoing","The Vampire Diaries","The Walking Dead",
  "The Walking Dead: Daryl Dixon","The Walking Dead: The Ones Who Live","The Wallflower (Yamato Nadeshiko)",
  "The Whispers","The White Queen","The Wire","The Wonderful Adventures of Nils",
  "The Woody Woodpecker and Friends","This Is Us","This Other Thing","Tin Man","Titanic",
  "Titanic: Blood and Steel","Titans","Tokyo Ghoul","Tom and Jerry","Totally Spies!","Touch",
  "Traveler","Tru Calling","True Blood","True Detective","Tut","Twisted","Two and a Half Men",
  "Tyrant","Unbelievable","Under the Dome","Unforgettable","Unorthodox","Up All Night","V","Vagabond",
  "Vixen","W","WandaVision","War & Peace","Wayward Pines","Web Therapy","Weeds","Westworld",
  "Wet Hot American Summer","What If...?","When They See Us","Whitney","Will & Grace",
  "Witches of East End","Wizards of Waverly Place","XIII","Young & Hungry",
  "Your Friendly Neighborhood Spider-Man","Z Nation","Zoo","Zorro"
];

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// Anime detection by title keywords
const ANIME_KEYWORDS = [
  "attack on titan","death note","code geass","tokyo ghoul","charlotte","citrus","erased",
  "seraph of the end","shomin sample","terra formars","terror in resonance","the seven deadly sins",
  "the wallflower","yamato nadeshiko","aoi bungaku","aoki densetsu","bomberman jetters",
  "cooking papa","doraemon","digimon","future boy conan","hello sandybell","high school dxd",
  "joker game","kill me heal me","kimi ni todoke","kokoro connect","mazinger z","megalobox",
  "mitsudomoe","muka muka","muteki kanban","my daddy long legs","nadia","olive et tom",
  "reLIFE","remi","ristorante paradiso","romance of the three kingdoms","sangokushi",
  "slam dunk","sonic","spy x family","squid game","super electromagnetic","combattler",
  "supernatural: the animation","overlord","b: the beginning","primal"
];

function isAnimeTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return ANIME_KEYWORDS.some(k => lower.includes(k));
}

async function searchTvShow(title: string): Promise<any | null> {
  // Clean title for search
  let searchTitle = title
    .replace(/\(.*?\)/g, '') // remove parenthetical
    .replace(/:.*/g, '') // remove subtitle after colon
    .trim();
  
  const url = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchTitle)}&include_adult=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      // Return first result
      return data.results[0];
    }
    // Try with full title
    if (searchTitle !== title) {
      const url2 = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=true`;
      const res2 = await fetch(url2);
      if (!res2.ok) return null;
      const data2 = await res2.json();
      if (data2.results && data2.results.length > 0) return data2.results[0];
    }
    return null;
  } catch {
    return null;
  }
}

async function getShowDetails(tmdbId: number): Promise<any | null> {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  console.log(`[START] Adding ${SHOWS.length} TV shows as finished...`);
  
  let added = 0;
  let updated = 0;
  let failed = 0;
  let notFound = 0;

  for (let i = 0; i < SHOWS.length; i++) {
    const title = SHOWS[i];
    const anime = isAnimeTitle(title);

    try {
      // Search TMDB
      const result = await searchTvShow(title);
      
      if (!result) {
        console.log(`  [${i + 1}/${SHOWS.length}] NOT FOUND: ${title}`);
        notFound++;
        failed++;
        continue;
      }

      const tmdbId = result.id;
      const poster = result.poster_path ? `${TMDB_IMG}${result.poster_path}` : null;
      const year = result.first_air_date ? result.first_air_date.slice(0, 4) : null;
      const overview = result.overview || null;
      const rating = result.vote_average ? String(result.vote_average) : null;

      // Get full details for episode count
      const details = await getShowDetails(tmdbId);
      const totalEpisodes = details?.number_of_episodes || null;
      const seasons = details?.number_of_seasons || null;
      const status = details?.status || null;
      const genres = details?.genres?.map((g: any) => g.name) || [];

      const id = `tmdb_${tmdbId}_finished`;

      // Check if already exists
      const existing = await db.media.findFirst({
        where: { tmdbId },
      });

      if (existing) {
        // Update as finished
        await db.media.update({
          where: { id: existing.id },
          data: {
            watched: true,
            watchedAt: new Date(),
            userRating: existing.userRating || 75, // keep existing rating or default 75
            status: "watched",
            poster: poster || existing.poster,
            overview: overview || existing.overview,
            rating: rating || existing.rating,
            episodes: totalEpisodes || existing.episodes,
            seasons: seasons || existing.seasons,
            genres: genres.length > 0 ? genres : existing.genres,
            isAnime: anime || existing.isAnime,
          },
        });
        updated++;
      } else {
        // Create new
        await db.media.create({
          data: {
            id,
            tmdbId,
            title,
            type: "series",
            poster,
            year,
            overview,
            rating,
            genres,
            episodes: totalEpisodes,
            seasons,
            status: "watched",
            watched: true,
            watchedAt: new Date(),
            userRating: 75, // default rating
            isAnime: anime,
            tags: ["finished"],
          },
        });
        added++;
      }

      if ((i + 1) % 20 === 0 || i === SHOWS.length - 1) {
        console.log(`  [${i + 1}/${SHOWS.length}] Added: ${added} | Updated: ${updated} | Not found: ${notFound} | Last: ${title}`);
      }
    } catch (e) {
      console.error(`  ERROR: ${title} - ${e instanceof Error ? e.message : e}`);
      failed++;
    }

    // Small delay
    if ((i + 1) % 10 === 0) await sleep(300);
  }

  console.log(`\n[DONE] Added: ${added} | Updated: ${updated} | Not found: ${notFound} | Failed: ${failed} | Total: ${SHOWS.length}`);
}

main()
  .catch((e) => { console.error("[ERROR]", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
