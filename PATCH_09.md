# Patch 09 — Data lifecycle, preferences, navigation, RTL and accessibility

## User-visible result

- Backup format v6 includes the core library, watched episodes, episode ratings,
  diary sessions, notifications, custom lists and their items, plus timezone,
  country and preferred-platform preferences.
- Restore still accepts v5 NDJSON and legacy JSON backups. New collections are
  validated in staging and committed in the same transaction as the library.
- “Clear all data” now deletes every user-owned content table while explicitly
  preserving the account and its preferences.
- Preferences synchronize through `/api/user`, affect Where to Watch and diary
  timestamps, and are portable through backup/restore.
- Custom Lists are available directly in navigation on desktop and
  mobile; keyboard shortcuts are provided for each.
- Search shortcuts use one explicit command rather than competing listeners or
  placeholder queries.
- Arabic routes have route-specific canonical metadata. RTL is scoped to Arabic
  content so the shared header and footer stay LTR.
- List dialogs use the shared Radix dialog primitive from Patch 08.

## Database rollout

Migration `20260718000000_data_lifecycle_preferences` adds account preference
columns and NOT VALID check constraints. The constraints protect new/updated
rows immediately without assuming historical production data is already clean.
Run the migration on a verified clone first, then use the standard guarded
`db:migrate:deploy` path.

## Verification

```bash
npm run verify:patch-09
npx tsc --noEmit
```
