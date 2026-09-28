# Database baseline and deployment runbook

Patch 05 introduces a complete migration history. The first migration now creates
the core schema on an empty PostgreSQL database, and a later additive migration
creates or reconciles Diary, Notifications and Custom Lists.

## New or disposable database

Use a fresh database URL and run:

```bash
npm run db:migrate:deploy
```

The command validates the PostgreSQL target, verifies the migration files,
applies only reviewed migrations, and then checks the live schema in a read-only
transaction.

## Existing database that was created with `prisma db push`

Do **not** run the new baseline directly on production. Existing tables would
collide with the baseline. Use this sequence instead:

1. Take a provider-level backup and restore it to an isolated clone.
2. Point `DATABASE_URL` at the clone.
3. Run `npm run db:inspect:baseline`. This command is read-only.
4. Compare the clone with `prisma/schema.prisma` and resolve every reported
   difference. Do not continue when a core table is missing.
5. On the clone only, record the baseline as already represented by the existing
   tables:

   ```bash
   npx prisma migrate resolve --applied 20260710000000_baseline_core
   ```

6. Run `npm run db:migrate:status`, then `npm run db:migrate:deploy`.
7. Exercise authentication and every library, tracking, Diary, Notifications and
   Lists route against the clone.
8. Restore the backup again and repeat the procedure to prove it is repeatable.
9. Schedule a maintenance window for production, take a fresh backup, record the
   baseline, apply the reviewed forward migrations, and run
   `npm run db:verify:schema` before deploying the application.

If the existing database has no `_prisma_migrations` table, each older migration
must be reconciled deliberately. Never mark a migration as applied merely to make
`migrate status` green; verify that every object and data transformation represented
by that migration is already present.

## Commands intentionally blocked

The following aliases always fail because they can rewrite or drop production
schema outside the reviewed migration history:

```text
db:push
db:sync
db:reset
db:migrate
```

Create migration SQL in a separate development database and review it before it
is added to `prisma/migrations`. Production and Preview deployments use
`prisma migrate deploy` only.

## Build behavior

The production build performs these steps in order:

1. Validate that `DATABASE_URL` is a real PostgreSQL URL and is not the audit URL.
2. Verify that every Prisma model is represented by an ordered migration.
3. Generate Prisma Client.
4. Verify the deployed tables, columns, indexes, constraints, RLS policies and
   migration records inside a read-only transaction.
5. Run `next build`.

A schema mismatch stops the build before a new application version is served.
