#!/usr/bin/env python3
"""Run a privacy-preserving, read-only audit against the TvTime database.

The connection string is intentionally accepted only through the
TVTIME_AUDIT_DATABASE_URL environment variable. Use a dedicated role that has
SELECT access only; never use the application owner or migration credentials.
"""

from __future__ import annotations

import os
import re
import sys
from contextlib import closing
from typing import Any

try:
    import psycopg2
    from psycopg2.extensions import connection as PgConnection
    from psycopg2.extensions import cursor as PgCursor
except ImportError:  # pragma: no cover - depends on the operator environment
    print(
        "Missing dependency: install psycopg2-binary in an isolated Python environment.",
        file=sys.stderr,
    )
    raise SystemExit(2)


DSN_ENV_VAR = "TVTIME_AUDIT_DATABASE_URL"
DEFAULT_STATEMENT_TIMEOUT_MS = 15_000
DATABASE_URL_PATTERN = re.compile(r"postgres(?:ql)?://[^\s]+", re.IGNORECASE)


class AuditConfigurationError(RuntimeError):
    """Raised when the audit cannot start safely."""


def redact_error(message: str) -> str:
    """Remove connection strings from database/client error messages."""

    return DATABASE_URL_PATTERN.sub("postgresql://<redacted>", message)


def load_database_url() -> str:
    database_url = os.environ.get(DSN_ENV_VAR, "").strip()
    if not database_url:
        raise AuditConfigurationError(
            f"{DSN_ENV_VAR} is required. Configure a dedicated SELECT-only audit role."
        )

    if not database_url.startswith(("postgresql://", "postgres://")):
        raise AuditConfigurationError(
            f"{DSN_ENV_VAR} must be a PostgreSQL connection string."
        )

    return database_url


def load_statement_timeout_ms() -> int:
    raw_value = os.environ.get(
        "TVTIME_AUDIT_STATEMENT_TIMEOUT_MS", str(DEFAULT_STATEMENT_TIMEOUT_MS)
    )
    try:
        timeout_ms = int(raw_value)
    except ValueError as exc:
        raise AuditConfigurationError(
            "TVTIME_AUDIT_STATEMENT_TIMEOUT_MS must be an integer."
        ) from exc

    if timeout_ms < 1_000 or timeout_ms > 120_000:
        raise AuditConfigurationError(
            "TVTIME_AUDIT_STATEMENT_TIMEOUT_MS must be between 1000 and 120000."
        )

    return timeout_ms


def connect_read_only(database_url: str, timeout_ms: int) -> PgConnection:
    connection = psycopg2.connect(
        database_url,
        connect_timeout=10,
        application_name="tvtime-readonly-audit",
        options=f"-c statement_timeout={timeout_ms}",
    )
    connection.set_session(readonly=True, autocommit=False)
    return connection


def ensure_least_privilege_role(cursor: PgCursor) -> None:
    """Refuse owner, bypass-RLS, or write-capable credentials."""

    cursor.execute(
        """
        SELECT
          role.rolname,
          role.rolsuper,
          role.rolcreaterole,
          role.rolcreatedb,
          role.rolreplication,
          role.rolbypassrls,
          database.datdba = role.oid AS owns_database,
          EXISTS (
            SELECT 1
            FROM pg_class relation
            JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
            WHERE relation.relowner = role.oid
              AND relation.relkind IN ('r', 'p', 'v', 'm', 'S')
              AND namespace.nspname NOT IN ('pg_catalog', 'information_schema')
          ) AS owns_application_objects
        FROM pg_roles role
        JOIN pg_database database ON database.datname = current_database()
        WHERE role.rolname = current_user;
        """
    )
    role = cursor.fetchone()
    if role is None:
        raise AuditConfigurationError("Unable to verify the current database role.")

    role_name, *risk_flags = role
    if any(risk_flags):
        raise AuditConfigurationError(
            f"Database role {role_name!r} is privileged or owns database objects. "
            "Create a dedicated SELECT-only audit role."
        )

    cursor.execute(
        """
        SELECT DISTINCT grants.table_schema, grants.table_name, grants.privilege_type
        FROM information_schema.role_table_grants grants
        WHERE grants.grantee IN (
          SELECT role_name FROM information_schema.enabled_roles
        )
          AND grants.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND grants.privilege_type <> 'SELECT'
        ORDER BY grants.table_schema, grants.table_name, grants.privilege_type
        LIMIT 10;
        """
    )
    write_grants = cursor.fetchall()
    if write_grants:
        raise AuditConfigurationError(
            "The audit role inherits non-SELECT table privileges. "
            "Remove write grants before running this script."
        )


def fetch_scalar(cursor: PgCursor, query: str) -> Any:
    cursor.execute(query)
    row = cursor.fetchone()
    return None if row is None else row[0]


def print_row_counts(cursor: PgCursor) -> None:
    print("=== TABLE ROW COUNTS ===")
    cursor.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM "User") AS users,
          (SELECT COUNT(*) FROM "Media") AS media,
          (SELECT COUNT(*) FROM "WatchedEpisode") AS watched_episodes,
          (SELECT COUNT(*) FROM "Rating") AS ratings,
          (SELECT COUNT(*) FROM "WatchlistItem") AS legacy_watchlist,
          (SELECT COUNT(*) FROM "WatchedMovie") AS legacy_watched_movies,
          (SELECT COUNT(*) FROM "FollowingShow") AS legacy_following;
        """
    )
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError("Row count query returned no result.")

    labels = (
        "Users",
        "Media",
        "WatchedEpisode",
        "Rating",
        "Legacy WatchlistItem",
        "Legacy WatchedMovie",
        "Legacy FollowingShow",
    )
    for label, value in zip(labels, row, strict=True):
        print(f"{label}: {value}")


def print_grouped_counts(cursor: PgCursor) -> None:
    print("\n=== MEDIA BREAKDOWN BY TYPE ===")
    cursor.execute(
        'SELECT type, COUNT(*) FROM "Media" GROUP BY type ORDER BY COUNT(*) DESC;'
    )
    for media_type, count in cursor.fetchall():
        print(f"  {media_type}: {count}")

    print("\n=== MEDIA BY STATUS ===")
    cursor.execute(
        'SELECT status, COUNT(*) FROM "Media" GROUP BY status ORDER BY COUNT(*) DESC;'
    )
    for status, count in cursor.fetchall():
        print(f"  {status}: {count}")


def print_integrity_checks(cursor: PgCursor) -> None:
    print("\n=== DATA INTEGRITY ===")
    null_tmdb_ids = fetch_scalar(
        cursor, 'SELECT COUNT(*) FROM "Media" WHERE "tmdbId" IS NULL;'
    )
    print(f"  Media with NULL tmdbId: {null_tmdb_ids}")

    cursor.execute(
        """
        SELECT COUNT(*)
        FROM (
          SELECT "userId", type, "tmdbId"
          FROM "Media"
          WHERE "tmdbId" IS NOT NULL
          GROUP BY "userId", type, "tmdbId"
          HAVING COUNT(*) > 1
        ) duplicates;
        """
    )
    print(f"  Duplicate media groups: {cursor.fetchone()[0]}")

    orphan_episodes = fetch_scalar(
        cursor,
        """
        SELECT COUNT(*) FROM "WatchedEpisode" watched_episode
        WHERE NOT EXISTS (
          SELECT 1 FROM "Media" media
          WHERE media."tmdbId" = watched_episode."showId"
            AND media."userId" = watched_episode."userId"
            AND media.type = 'series'
        );
        """,
    )
    print(f"  Orphan watched episodes: {orphan_episodes}")


def print_database_size(cursor: PgCursor) -> None:
    print("\n=== DATABASE SIZE ===")
    print(
        f"  Database size: {fetch_scalar(cursor, 'SELECT pg_size_pretty(pg_database_size(current_database()));')}"
    )

    cursor.execute(
        """
        SELECT
          relname AS table_name,
          pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
          n_live_tup AS estimated_row_count
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC;
        """
    )
    for table_name, total_size, estimated_rows in cursor.fetchall():
        print(f"  {table_name}: {total_size} ({estimated_rows} estimated rows)")


def print_index_summary(cursor: PgCursor) -> None:
    print("\n=== INDEX SUMMARY ===")
    cursor.execute(
        """
        SELECT tablename, COUNT(*)
        FROM pg_indexes
        WHERE schemaname = 'public'
        GROUP BY tablename
        ORDER BY tablename;
        """
    )
    for table_name, index_count in cursor.fetchall():
        print(f"  {table_name}: {index_count} index(es)")


def print_rls_summary(cursor: PgCursor) -> None:
    print("\n=== ROW-LEVEL SECURITY ===")
    cursor.execute(
        """
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class relation
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p')
        ORDER BY relname;
        """
    )
    for table_name, enabled, forced in cursor.fetchall():
        print(f"  {table_name}: enabled={enabled}, forced={forced}")

    cursor.execute(
        """
        SELECT tablename, COUNT(*)
        FROM pg_policies
        WHERE schemaname = 'public'
        GROUP BY tablename
        ORDER BY tablename;
        """
    )
    policies = cursor.fetchall()
    print(f"  Tables with policies: {len(policies)}")
    for table_name, policy_count in policies:
        print(f"    {table_name}: {policy_count} policy/policies")


def run_audit(connection: PgConnection) -> None:
    with closing(connection.cursor()) as cursor:
        ensure_least_privilege_role(cursor)
        print_row_counts(cursor)
        print_grouped_counts(cursor)
        print_integrity_checks(cursor)
        print_database_size(cursor)
        print_index_summary(cursor)
        print_rls_summary(cursor)

    # End the read-only snapshot without committing any transaction state.
    connection.rollback()
    print("\n=== READ-ONLY AUDIT COMPLETE ===")


def main() -> int:
    try:
        database_url = load_database_url()
        timeout_ms = load_statement_timeout_ms()
        with closing(connect_read_only(database_url, timeout_ms)) as connection:
            run_audit(connection)
        return 0
    except AuditConfigurationError as exc:
        print(f"Audit refused: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:  # pragma: no cover - requires a live database
        print(f"Database audit failed: {redact_error(str(exc))}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
