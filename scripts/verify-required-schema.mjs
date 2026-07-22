#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requiredTables = [
  "User",
  "Media",
  "WatchlistItem",
  "WatchedMovie",
  "WatchedEpisode",
  "FollowingShow",
  "Rating",
  "TvMetadataCache",
  "WatchSession",
  "Notification",
  "LibraryImportSession",
  "LibraryImportChunk",
  "LibraryImportRecord",
];

const requiredColumns = {
  Media: ["isFollowing", "isArabic", "originalLanguage", "originCountries"],
  TvMetadataCache: [
    "airedEpisodeCount", "airedEpisodeKeys", "refreshAfter", "originalLanguage",
    "originCountries", "genreIds", "genreNames", "classificationComplete",
  ],
  User: ["timezone", "country", "preferredPlatforms"],
  WatchSession: ["userId", "mediaId", "mediaType", "tmdbId", "watchedAt"],
  Notification: ["userId", "type", "read", "createdAt"],
  LibraryImportSession: ["userId", "version", "status", "manifest", "expectedRecords", "receivedRecords", "expiresAt"],
  LibraryImportChunk: ["sessionId", "sequence", "checksum", "recordCount"],
  LibraryImportRecord: ["sessionId", "collection", "ordinal", "payload"],
};

const requiredIndexes = [
  "Media_userId_type_tmdbId_key",
  "Media_userId_isArabic_idx",
  "WatchedEpisode_userId_showId_seasonNumber_episodeNumber_key",
  "LibraryImportChunk_sessionId_sequence_key",
  "LibraryImportRecord_sessionId_collection_ordinal_key",
];

const requiredConstraints = [
  "Media_media_world_exclusive_check",
  "Media_userId_type_tmdbId_key",
  "WatchSession_userId_fkey",
  "WatchSession_mediaId_fkey",
  "Notification_userId_fkey",
  "LibraryImportSession_userId_fkey",
  "LibraryImportChunk_sessionId_fkey",
  "LibraryImportRecord_sessionId_fkey",
  "LibraryImportSession_status_check",
  "User_country_format_check",
  "Media_userRating_range_check",
  "Media_rewatchCount_nonnegative_check",
  "Media_type_supported_check",
  "Rating_value_range_check",
  "WatchedEpisode_numbers_check",
  "WatchSession_values_check",
];

const requiredPolicies = [
  "media_isolate_own_rows",
  "watched_episode_isolate_own_rows",
  "rating_isolate_own_rows",
  "user_isolate_own_row",
  "watch_session_isolate_own_rows",
  "notification_isolate_own_rows",
  "library_import_session_isolate_own_rows",
  "library_import_chunk_isolate_own_rows",
  "library_import_record_isolate_own_rows",
];

const requiredMigrations = [
  "20260710000000_baseline_core",
  "20260711160000_media_identity_unique",
  "20260712150000_arabic_media_worlds",
  "20260714000000_enable_rls",
  "20260714010000_tv_metadata_cache",
  "20260715000000_feature_tables_and_rls",
  "20260716000000_staged_library_import",
  "20260717000000_tv_metadata_cache_integrity",
  "20260718000000_data_lifecycle_preferences",
  "20260722000000_remove_dead_mymedia_data",
  "20260722010000_remove_custom_lists",
];

function assertAll(label, required, present) {
  const missing = required.filter((value) => !present.has(value));
  if (missing.length > 0) throw new Error(`${label} missing: ${missing.join(", ")}`);
}

try {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '20s'");

    const tables = await tx.$queryRawUnsafe(`
      SELECT table_name AS "name"
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
    `);
    const tableSet = new Set(tables.map((row) => String(row.name)));
    assertAll("Required tables", requiredTables, tableSet);

    const columns = await tx.$queryRawUnsafe(`
      SELECT table_name AS "table", column_name AS "column", is_nullable AS "nullable"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
    `);
    const columnSet = new Set(columns.map((row) => `${row.table}.${row.column}`));
    for (const [table, names] of Object.entries(requiredColumns)) {
      assertAll(`${table} columns`, names.map((name) => `${table}.${name}`), columnSet);
    }

    const legacyTvIdentityRows = await tx.$queryRawUnsafe(`
      SELECT COUNT(*)::integer AS "count"
      FROM "Media"
      WHERE "type" = 'tv'
    `);
    if (Number(legacyTvIdentityRows[0]?.count || 0) > 0) {
      throw new Error('Media contains legacy type="tv" rows; normalize them to type="series" before deployment.');
    }

    const indexes = await tx.$queryRawUnsafe(`
      SELECT indexname AS "name" FROM pg_indexes WHERE schemaname = current_schema()
    `);
    assertAll("Required indexes", requiredIndexes, new Set(indexes.map((row) => String(row.name))));

    const constraints = await tx.$queryRawUnsafe(`
      SELECT conname AS "name"
      FROM pg_constraint constraint_row
      JOIN pg_class relation ON relation.oid = constraint_row.conrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = current_schema()
    `);
    assertAll("Required constraints", requiredConstraints, new Set(constraints.map((row) => String(row.name))));

    const rlsTables = await tx.$queryRawUnsafe(`
      SELECT relname AS "name"
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = current_schema()
        AND relation.relkind = 'r'
        AND relation.relrowsecurity = true
    `);
    assertAll(
      "RLS-enabled tables",
      [
        "User", "Media", "WatchedEpisode", "Rating", "WatchSession", "Notification",
        "LibraryImportSession", "LibraryImportChunk", "LibraryImportRecord",
      ],
      new Set(rlsTables.map((row) => String(row.name))),
    );

    const policies = await tx.$queryRawUnsafe(`
      SELECT policyname AS "name" FROM pg_policies WHERE schemaname = current_schema()
    `);
    assertAll("Required RLS policies", requiredPolicies, new Set(policies.map((row) => String(row.name))));

    const migrationTablePresent = tableSet.has("_prisma_migrations");
    if (!migrationTablePresent) throw new Error("_prisma_migrations is missing; migration state is not managed.");
    const migrations = await tx.$queryRawUnsafe(`
      SELECT migration_name AS "name", finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
      FROM "_prisma_migrations"
    `);
    const applied = new Set(
      migrations
        .filter((row) => row.finishedAt && !row.rolledBackAt)
        .map((row) => String(row.name)),
    );
    assertAll("Applied migrations", requiredMigrations, applied);
    const failed = migrations.filter((row) => !row.finishedAt && !row.rolledBackAt);
    if (failed.length > 0) {
      throw new Error(`Unresolved failed migrations: ${failed.map((row) => row.name).join(", ")}`);
    }
  }, { timeout: 30_000 });

  console.log("[database-schema] The deployed schema, migration history, indexes and RLS contract are ready.");
} catch (error) {
  console.error("[database-schema] Read-only deployment schema verification failed.");
  console.error(error instanceof Error ? error.message : error);
  console.error("Apply reviewed migrations on a verified clone first; never use db push or reset on production.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
