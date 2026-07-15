console.error('[RECOVERY] Destructive Prisma schema commands are disabled in the emergency recovery build.');
console.error('[RECOVERY] Do not run prisma db push/reset/migrate until a reviewed, backup-backed migration is prepared.');
process.exit(1);
