import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const media = await prisma.media.count();
  const users = await prisma.user.count();
  const watchedEpisodes = await prisma.watchedEpisode.count();
  const watchlistItems = await prisma.watchlistItem.count();
  const tvMetadata = await prisma.tvMetadataCache.count();
  const watchSessions = await prisma.watchSession.count();
  const notifications = await prisma.notification.count();
  
  console.log('=== EXISTING DATA (must be intact) ===');
  console.log('Media:', media);
  console.log('Users:', users);
  console.log('WatchedEpisodes:', watchedEpisodes);
  console.log('WatchlistItems:', watchlistItems);
  console.log('TvMetadataCache:', tvMetadata);
  console.log('');
  console.log('=== NEW TABLES (expected to be 0 — fresh) ===');
  console.log('WatchSessions:', watchSessions);
  console.log('Notifications:', notifications);
  
  const sample = await prisma.media.findFirst({
    select: { id: true, title: true, rewatchCount: true, notifyOnNewEpisode: true }
  });
  console.log('');
  console.log('Sample media (with new fields):', sample);
}
main().catch(console.error).finally(() => prisma.$disconnect());
