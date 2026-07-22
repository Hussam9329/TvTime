import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const media = await prisma.media.count();
  const users = await prisma.user.count();
  const watchedEpisodes = await prisma.watchedEpisode.count();
  const watchlistItems = await prisma.watchlistItem.count();
  const tvMetadata = await prisma.tvMetadataCache.count();
  
  // New tables (should be 0)
  const watchSessions = await prisma.watchSession.count();
  const notifications = await prisma.notification.count();
  
  console.log('=== EXISTING DATA (intact) ===');
  console.log('Media:', media);
  console.log('Users:', users);
  console.log('WatchedEpisodes:', watchedEpisodes);
  console.log('WatchlistItems:', watchlistItems);
  console.log('TvMetadataCache:', tvMetadata);
  console.log('');
  console.log('=== NEW TABLES (empty, ready to use) ===');
  console.log('WatchSessions:', watchSessions);
  console.log('Notifications:', notifications);
  
  // Sample media to confirm rewatchCount field exists
  const sample = await prisma.media.findFirst({
    select: { id: true, title: true, rewatchCount: true, notifyOnNewEpisode: true }
  });
  console.log('');
  console.log('Sample (with new fields):', sample);
}
main().catch(console.error).finally(() => prisma.$disconnect());
