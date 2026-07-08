import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const db = new PrismaClient({ log: ['error'] });
const SHOWS = fs.readFileSync('scripts/add-finished-shows.ts', 'utf-8').split('const SHOWS = [')[1].split('];')[0].match(/"[^"]+"/g)!.map(s => s.slice(1, -1));
async function main() {
  console.log('Fixing', SHOWS.length, 'shows...');
  let fixed = 0;
  for (let i = 0; i < SHOWS.length; i++) {
    const r = await db.media.updateMany({ where: { title: SHOWS[i], type: 'series' }, data: { watched: true, watchedAt: new Date(), status: 'watched', userRating: 75 } });
    if (r.count > 0) fixed++;
  }
  console.log('Fixed:', fixed);
  const f = await db.media.findFirst({ where: { title: 'Friends', type: 'series' } });
  console.log('Friends:', f?.watched, f?.status, f?.userRating);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
