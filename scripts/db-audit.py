#!/usr/bin/env python3
"""Database audit script for TvTime Neon Postgres"""
import psycopg2
import json

DB_URL = "postgresql://neondb_owner:npg_logS9zJF7keO@ep-bold-hat-atw8l2bl-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

print("=== TABLE ROW COUNTS ===")
cur.execute("""
SELECT
  (SELECT COUNT(*) FROM "User") AS users,
  (SELECT COUNT(*) FROM "Media") AS media,
  (SELECT COUNT(*) FROM "WatchedEpisode") AS watched_episodes,
  (SELECT COUNT(*) FROM "Rating") AS ratings,
  (SELECT COUNT(*) FROM "WatchlistItem") AS legacy_watchlist,
  (SELECT COUNT(*) FROM "WatchedMovie") AS legacy_watched_movies,
  (SELECT COUNT(*) FROM "FollowingShow") AS legacy_following;
""")
row = cur.fetchone()
print(f"Users: {row[0]}")
print(f"Media: {row[1]}")
print(f"WatchedEpisode: {row[2]}")
print(f"Rating: {row[3]}")
print(f"Legacy WatchlistItem: {row[4]}")
print(f"Legacy WatchedMovie: {row[5]}")
print(f"Legacy FollowingShow: {row[6]}")

print("\n=== MEDIA BREAKDOWN BY TYPE ===")
cur.execute("""
SELECT type, COUNT(*) FROM "Media" GROUP BY type ORDER BY COUNT(*) DESC;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

print("\n=== MEDIA BY STATUS ===")
cur.execute("""
SELECT status, COUNT(*) FROM "Media" GROUP BY status ORDER BY COUNT(*) DESC;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

print("\n=== MEDIA NULL tmdbId (data integrity issue) ===")
cur.execute('SELECT COUNT(*) FROM "Media" WHERE "tmdbId" IS NULL;')
print(f"  Media with NULL tmdbId: {cur.fetchone()[0]}")

print("\n=== TOP 10 USERS BY MEDIA COUNT ===")
cur.execute("""
SELECT "userId", COUNT(*) AS c FROM "Media"
GROUP BY "userId" ORDER BY c DESC LIMIT 10;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

print("\n=== INDEX CHECK ===")
cur.execute("""
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

print("\n=== DB SIZE ===")
cur.execute("SELECT pg_size_pretty(pg_database_size(current_database()));")
print(f"  Database size: {cur.fetchone()[0]}")

cur.execute("""
SELECT
  relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
""")
print("\n=== TABLE SIZES ===")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} ({r[2]} rows)")

print("\n=== DUPLICATE MEDIA CHECK (should be 0 due to unique constraint) ===")
cur.execute("""
SELECT "userId", type, "tmdbId", COUNT(*) FROM "Media"
WHERE "tmdbId" IS NOT NULL
GROUP BY "userId", type, "tmdbId"
HAVING COUNT(*) > 1
LIMIT 5;
""")
duplicates = cur.fetchall()
print(f"  Duplicate groups: {len(duplicates)}")

print("\n=== WATCHED EPISODES FOR NON-EXISTENT SHOWS (orphan check) ===")
cur.execute("""
SELECT COUNT(*) FROM "WatchedEpisode" we
WHERE NOT EXISTS (
  SELECT 1 FROM "Media" m WHERE m."tmdbId" = we."showId" AND m."userId" = we."userId" AND m.type = 'series'
);
""")
print(f"  Orphan watched episodes: {cur.fetchone()[0]}")

print("\n=== USERS TABLE CONTENT (any sensitive data?) ===")
cur.execute('SELECT id, name, avatar, "createdAt", "updatedAt" FROM "User" LIMIT 10;')
for r in cur.fetchall():
    print(f"  id={r[0]} name={r[1]} avatar={r[2]} createdAt={r[3]}")

print("\n=== RLS POLICY CHECK (should be empty - no RLS!) ===")
cur.execute("""
SELECT pol.tablename, pol.policyname, pol.cmd, pol.roles FROM pg_policies pol;
""")
policies = cur.fetchall()
print(f"  RLS policies found: {len(policies)}")
for p in policies:
    print(f"  - {p}")

print("\n=== TABLE ROW-LEVEL SECURITY STATUS ===")
cur.execute("""
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY relname;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: rls_enabled={r[1]} rls_forced={r[2]}")

cur.close()
conn.close()
print("\n=== AUDIT COMPLETE ===")
