import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const media = await prisma.media.count();
  const users = await prisma.user.count();
  const episodes = await prisma.episode.count();
  const sessions = await prisma.watchSession.count();
  console.log('Media:', media);
  console.log('Users:', users);
  console.log('Episodes:', episodes);
  console.log('WatchSessions:', sessions);
  
  const byType = await prisma.media.groupBy({
    by: ['mediaType'],
    _count: { _all: true }
  });
  console.log('By type:', JSON.stringify(byType));
  
  const byStatus = await prisma.media.groupBy({
    by: ['status'],
    _count: { _all: true }
  });
  console.log('By status:', JSON.stringify(byStatus));
}
main().catch(console.error).finally(() => prisma.$disconnect());
