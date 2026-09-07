# PATCH 21 — Cinematic Profiles + Premium Header

## Scope

- Rebuild Movie detail presentation around a full-width cinematic backdrop, poster-led identity, restrained fact row, premium actions, dual rating panels, and underline tabs.
- Rebuild TV detail presentation with the same visual DNA plus a TV-specific fact row, creator/genre hierarchy, compact rating lock treatment, season controls, progress and horizontal episode cards.
- Restyle the global desktop/tablet header into a translucent premium bar with compact active navigation, a larger command search, stronger Trakora wordmark and profile treatment.
- Keep movie detail mapped to the Movies nav state and TV detail mapped to TV Shows.
- Allow detail backdrops to sit visually behind the sticky header while non-detail pages retain their existing layout.

## Behavior preserved

No changes to TMDB fetching, watch history, personal ratings, watchlist, following, rewatch, episode progress, episode ratings, database behavior or routing semantics.

## Verification

- `node scripts/verify-horizontal-shelves.mjs` — 21 checks passed.
- `node scripts/verify-user-facing-integrity.mjs` — 89 checks passed.
- `node --experimental-strip-types scripts/test-performance-regressions.ts` — passed.
- `scripts/test-responsive-layout.ts` remains blocked by the pre-existing missing `src/components/ui/toast.tsx` fixture/reference.
