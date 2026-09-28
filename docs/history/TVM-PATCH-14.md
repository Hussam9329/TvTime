# TVM-PATCH-14 — Structured Personal Rating

## Purpose

Whole-title movie and completed-series ratings are now built from 10 explicit criteria scored from 0 to 10. The canonical `userRating` remains a 0–100 integer for compatibility with existing cards, filters, statistics, recommendations and Watch Next, but it is derived on the server from the 10 saved criterion values.

Episode ratings remain the existing simple 0–100 rating flow.

## User flow

- A new movie cannot become Watched until all 10 movie criteria are scored and saved.
- An ended TV series cannot become Finished until all final episodes are watched and all 10 series criteria are scored and saved.
- Closing/cancelling the structured dialog performs no completion write.
- Re-rating a structured title preloads all 10 saved values.
- Legacy numeric-only ratings remain intact. No fake criterion breakdown is generated. Re-rating a legacy title starts with empty criteria and shows the previous legacy score for context.
- Removing a movie rating clears its structured breakdown and removes Watched completion, preserving the existing invariant.
- Removing a finished-series rating clears its breakdown and returns the show to Up To Date without deleting episode history.

## Rating formula

Each criterion is an integer from 0 through 10. All 10 are required.

`final score / 100 = criterion 1 + ... + criterion 10`

The client shows the running score, but the API validates all criteria and derives the canonical score itself.

## Persistence

`Media.ratingBreakdown Json?` stores versioned structured rating data:

```json
{
  "version": 1,
  "kind": "movie",
  "criteria": {
    "storyIdea": 10,
    "writingLogic": 9,
    "pacing": 8,
    "characters": 9,
    "acting": 9,
    "direction": 10,
    "atmosphere": 10,
    "impact": 10,
    "payoff": 9,
    "ending": 10
  }
}
```

Migration: `20260907010000_structured_personal_rating`.

Library backup format is bumped to version 8 and preserves `ratingBreakdown`. CSV export includes it as JSON. Watch Undo snapshots also preserve and restore it together with `userRating`.

## Responsive UI

`StructuredRatingDialog` is full-height (`100dvh`) on mobile with a scrollable criteria body and persistent action footer. On larger screens it becomes a centered bounded modal. Criterion explanatory sentences are always rendered in full and are never line-clamped or hidden behind tooltips.

## Verification

Run:

```bash
npm run verify:patch-14
node scripts/verify-user-facing-integrity.mjs
node scripts/verify-migration-history.mjs
```

The uploaded source did not include `node_modules`, so a full dependency-backed `npm run typecheck`/Next build could not be completed in the patching environment. The project source parser in `verify-user-facing-integrity.mjs` successfully parsed all TypeScript/TSX files without syntax diagnostics. The pre-existing responsive suite also references a missing `src/components/ui/toast.tsx` file that is absent from the original upload; this is unrelated to Patch 14.
