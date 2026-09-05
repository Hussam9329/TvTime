# PATCH 13 — Professional Edges, Overlap-Free Card Controls & Responsive Refinement

Focus: visual polish of corner geometry, elimination of element overlap on
poster cards, and responsive refinement for every screen class — from
ultra-compact phones (≤380px) to XL desktops (≥1536px).

## 1. Unified radius scale

Every corner in the app now derives from one harmonious scale:

| Token            | Value   | Applied to                                                |
| ---------------- | ------- | --------------------------------------------------------- |
| chip             | 0.55rem | Score badges, dock icons, small floating controls         |
| control          | 0.8rem  | Buttons, inputs, segmented controls, row arrows, tab pills |
| tabs             | 1rem    | Tab bars and library type switchers                        |
| card             | 1.1rem  | Posters, cards, panels, portal surfaces, anime next cards  |
| hero             | 1.5rem  | Heroes, floating header, mobile dock, search panel         |

- `--radius` (shadcn base) raised 0.7rem → 0.8rem so `rounded-lg` utilities
  match the control token, and `rounded-sm` matches the chip token.
- Poster radius (1.02rem), recent posters (1.1rem), skeletons (1.15rem),
  watch cards and anime next cards now all resolve to the single card token,
  removing the loading → loaded corner "jump".
- Corner score badges and the purple watchlist badge anchor radius track the
  poster radius exactly (1.1rem) so chips sit flush inside the poster frame.
- Floating header, mobile dock, search panel and both heroes share the hero
  radius (previously a mix of 1.25 / 1.45 / 1.55rem).

## 2. Overlap elimination on poster cards

- `.tvtime-media-copy` now has a deterministic 4.4rem height (title clamped
  to a fixed two-line 2.2rem box, meta line-height 1.4).
- The floating action dot anchors 0.5rem inside the poster's bottom-right
  edge — level with the state rail's 0.5rem inset on the opposite side —
  so it never straddles the poster frame and never collides with titles,
  metadata, or the state rail regardless of title length.
- The action dot is now a proper circular control (999px radius, 1.6rem;
  1.8rem on fine pointers) instead of a 1.3×0.9rem rectangle, with a soft
  gold focus ring instead of a hard outline.
- Watchlist badge resting below the TMDB score uses a uniform chip radius.

## 3. Responsive refinements

- ≤380px: tighter grid/shelf gutters and compact section headers so
  two-column poster grids breathe without horizontal overflow.
- Short landscape phones (≤480px height): hero heights capped at 15rem so
  primary actions stay reachable.
- ≥1536px: section rhythm and shelf gutters scale up so wide canvases feel
  composed rather than stretched.
- Sheet/dialog portal surfaces join the unified radius language
  (1.2rem for dialogs, themed per sheet side).

## 4. Optical alignment

- Section heading action cluster (See all + row arrows) is aligned to the
  icon centerline instead of drifting below the title.
- The section count pill is lifted 1px to compensate for the title's
  descender space (optical baseline alignment).

## Verification

- `node scripts/verify-user-facing-integrity.mjs` — updated expectations for
  the new menu geometry (0.5rem insets, 4.4rem copy block) and the 1.1rem
  watchlist corner radius. 89 checks pass.
- `scripts/test-responsive-layout.ts`, `scripts/test-performance-regressions.ts`,
  `scripts/verify-poster-hover-cleanup.mjs`, `scripts/verify-horizontal-shelves.mjs`
  and the remaining suite pass unchanged.
- Geometry was audited in-browser: poster 17.6px, link 17.6px, menu bottom
  78.4px (= 4.4rem + 0.5rem), state rail left 8px, copy height 70.4px —
  deterministic across title lengths.
