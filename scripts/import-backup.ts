// Import script: reads backup JSON and imports all media into Neon PostgreSQL
import { db } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

interface BackupItem {
  id: string;
  title: string;
  originalTitle: string | null;
  year: string | null;
  type: string;
  poster: string | null;
  rating: string | null;
  overview: string | null;
  genres: string[];
  episodes: number | null;
  seasons: number | null;
  duration: string | null;
  status: string | null;
  author: string | null;
  pages: number | null;
  tags: string[];
  notes: string;
  watched: boolean;
  watchedAt: string | null;
  userRating: number | null;
  rewatch: boolean;
  runtime: number | null;
  ratingStatus: string | null;
  addedAt: string;
  updatedAt: string;
}

async function main() {
  const backupPath = path.join(__dirname, '..', 'upload', 'hussamvision-backup-2026-07-07.json');
  const raw = fs.readFileSync(backupPath, 'utf-8');
  const items: BackupItem[] = JSON.parse(raw);

  console.log(`Importing ${items.length} items...`);

  let imported = 0;
  let errors = 0;
  const batchSize = 100;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      await db.media.createMany({
        data: batch.map((item) => ({
          id: item.id,
          title: item.title,
          originalTitle: item.originalTitle,
          year: item.year,
          type: item.type,
          poster: item.poster,
          rating: item.rating,
          overview: item.overview,
          genres: item.genres || [],
          episodes: item.episodes,
          seasons: item.seasons,
          duration: item.duration,
          status: item.status,
          author: item.author,
          pages: item.pages,
          tags: item.tags || [],
          notes: item.notes || '',
          watched: item.watched || false,
          watchedAt: item.watchedAt ? new Date(item.watchedAt) : null,
          userRating: item.userRating,
          rewatch: item.rewatch || false,
          runtime: item.runtime,
          ratingStatus: item.ratingStatus,
          addedAt: new Date(item.addedAt),
          updatedAt: new Date(item.updatedAt),
        })),
        skipDuplicates: true,
      });
      imported += batch.length;
      if (imported % 500 === 0 || i + batchSize >= items.length) {
        console.log(`  Imported ${imported}/${items.length}`);
      }
    } catch (e) {
      console.error(`Error at batch ${i}:`, e instanceof Error ? e.message : e);
      errors += batch.length;
    }
  }

  console.log(`\nDone! Imported: ${imported}, Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
