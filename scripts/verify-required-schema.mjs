import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function fail(message) {
  console.error(`\n[database-schema] ${message}`);
  console.error("Run `npm run db:migrate:status`, take a verified backup, then run `npm run db:migrate:deploy` before deploying this build.\n");
  process.exitCode = 1;
}

try {
  const [contract] = await prisma.$queryRaw`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Media'
          AND column_name = 'isFollowing'
          AND is_nullable = 'NO'
      ) AS "hasFollowingColumn",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Media'
          AND column_name = 'isArabic'
          AND is_nullable = 'NO'
      ) AS "hasArabicColumn",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Media'
          AND column_name = 'originalLanguage'
      ) AS "hasOriginalLanguageColumn",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Media'
          AND column_name = 'originCountries'
          AND is_nullable = 'NO'
      ) AS "hasOriginCountriesColumn",
      EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = 'Media'
          AND indexname = 'Media_userId_isArabic_idx'
      ) AS "hasArabicIndex",
      EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = '"Media"'::regclass
          AND conname = 'Media_media_world_exclusive_check'
          AND contype = 'c'
      ) AS "hasMediaWorldConstraint",
      EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = '"Media"'::regclass
          AND conname = 'Media_userId_type_tmdbId_key'
          AND contype = 'u'
      ) AS "hasMediaIdentityConstraint",
      NOT EXISTS (
        SELECT 1 FROM "Media" WHERE "type" = 'tv'
      ) AS "hasCanonicalSeriesType"
  `;

  if (!contract?.hasFollowingColumn) {
    fail('Required column Media.isFollowing is missing or nullable.');
  } else if (!contract?.hasArabicColumn || !contract?.hasOriginalLanguageColumn || !contract?.hasOriginCountriesColumn) {
    fail('Required Arabic media classification columns are missing or invalid.');
  } else if (!contract?.hasArabicIndex) {
    fail('Required index Media_userId_isArabic_idx is missing.');
  } else if (!contract?.hasMediaWorldConstraint) {
    fail('Required Media world exclusivity constraint is missing.');
  } else if (!contract?.hasMediaIdentityConstraint) {
    fail('Required unique constraint Media_userId_type_tmdbId_key is missing.');
  } else if (!contract?.hasCanonicalSeriesType) {
    fail('Legacy Media rows with type="tv" still exist.');
  } else {
    console.log('[database-schema] Required Media schema contract is ready.');
  }
} catch (error) {
  console.error('[database-schema] Could not verify the database schema without writing to it.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
