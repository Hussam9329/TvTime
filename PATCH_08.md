# Patch 08 — Lists and Discover contracts

This patch makes Custom Lists usable end to end and aligns Discover filters with
what the server and TMDB actually support.

## Included

- typed validation for list create/update/item mutations;
- checked HTTP mutations, retryable load errors, real posters, and duplicate-safe adds;
- an intentionally public, read-only `/list/[slug]` page and limited public API;
- shared Radix dialogs for list creation, item search, and sharing;
- Arabic TV uses the shared filtered Discover implementation;
- TV "Started" includes watched episodes and progress states;
- anime Discover and Releases support both movies and series;
- keyword phrases are resolved through TMDB keyword search and sent as
  `with_keywords`; the unsupported `with_text_query` parameter was removed.

Run `npm run verify:patch-08` after applying the patch.
