# Patch 12 — premium cinematic visual system

## Objective

Patch 12 is the second visual-quality pass for TvTime. It builds on the
semantic and accessible foundation from Patch 11, then gives the application a
more deliberate entertainment-product identity: a calmer command header, a
cinematic landing experience, poster-first content browsing, clearer
information hierarchy and a one-handed mobile navigation surface.

The work intentionally upgrades shared presentation and composition instead of
changing data behavior, routes or product permissions.

## Visual audit findings addressed

- The earlier foundation was consistent but still looked like a collection of
  generic cards rather than one recognizable viewing product.
- Desktop navigation exposed too many destinations at the same visual weight,
  competing with search and current-page context.
- Mobile relied on the side sheet for frequent destinations, increasing the
  effort required to move between Home, Watch Next, Discover, Movies and TV.
- Home had the right content but needed stronger editorial hierarchy between
  the featured title, personal library status and discovery rows.
- Media cards combined poster, metadata and actions inside a heavy elevated
  surface. This reduced poster prominence and created an invalid nested
  interactive pattern in some card configurations.
- Horizontal collections needed clearer labels, counts, scrolling affordances
  and touch-oriented snap behavior.
- Shared page heroes, filters, tabs and portals needed one restrained elevation
  language rather than unrelated per-page treatments.

## Delivered changes

### Premium shell and navigation hierarchy

- Rebuilt the header as a restrained floating command bar with a compact brand
  mark, clearer active state, command-style search and quieter utility actions.
- Centralized primary, secondary, mobile-dock and detail-view hierarchy in
  `src/lib/navigation-layout.ts`.
- Kept the six highest-value destinations in primary desktop navigation and
  grouped Stats and Arabic catalogues in a labelled **More** menu.
- Added a five-destination mobile dock with `aria-current`, safe-area spacing
  and focused detail-view suppression.
- Preserved the existing mobile sheet for the complete information
  architecture, so less frequent destinations remain discoverable.

### Cinematic home composition

- Reworked the featured title into an editorial hero with a dedicated backdrop,
  robust scrim, compact metadata, one dominant heading, paired actions and a
  desktop poster anchor.
- Added a grouped library overview that separates personal activity from
  discovery content and keeps key statistics scannable.
- Reframed Watch Next as the clear continuation action rather than another
  decorative card.
- Standardized Recently Watched and discovery rows around the same poster and
  heading language.

### Poster-first media browsing

- Changed the media-card anatomy to a semantic `article` containing one native
  detail link (or real button fallback) plus a separate actions menu.
- Removed staggered Framer Motion wrappers from repeated cards to reduce visual
  noise and rendering work.
- Promoted artwork, score and library-state badges while moving title and
  metadata into a lighter text block below the poster.
- Added visible keyboard focus, coarse-pointer action visibility, restrained
  hover elevation and reduced-motion behavior.
- Made score, state and action placement use logical inline positioning for
  correct Arabic RTL behavior.

### Shared visual system

- Added semantic content-width, surface, radius and elevation tokens for light
  and dark themes.
- Unified page heroes with controlled category accents rather than unrelated
  gradients.
- Refined shared Buttons, Inputs, Cards, Tabs and Badges with consistent control
  radii, weight and interaction feedback.
- Harmonized filters, dialogs, sheets, dropdowns, empty/error states, login and
  footer surfaces without forcing every section into a card.
- Added browser fallbacks for missing backdrop blur and preserved the existing
  forced-colors, coarse-pointer and reduced-motion protections.

### Responsive behavior

- Desktop uses the expanded command header, wider 1440px content canvas and
  editorial hero split.
- Tablet progressively reduces primary navigation density while preserving
  search and utility controls.
- Mobile uses a compact top bar plus safe-area bottom dock; the hero actions
  become full-width and library metrics become a horizontal snap row.
- Horizontal media collections use responsive fixed item widths and scroll
  snapping instead of shrinking desktop cards below readable sizes.

## Compatibility and risk

- No database migration.
- No API contract change.
- No Prisma schema change.
- No authentication or authorization behavior change.
- No dependency added or upgraded.
- Existing routes, Zustand navigation actions, query keys and media mutation
  handlers are preserved.
- The mobile dock is an additional navigation surface, not a route change.

The highest implementation risk is CSS interaction with older page-specific
rules. Patch 12 places its semantic layer last and includes an explicit final
poster-card reset so generic shared surfaces cannot re-box poster cards.

## Acceptance criteria

- Home exposes one `h1`, a readable hero in both themes and clear primary and
  secondary actions.
- Frequent mobile destinations are reachable in one tap and the active page is
  programmatically identified.
- Detail routes retain the existing back flow and do not show the mobile dock.
- Media cards contain no nested interactive controls and remain keyboard
  operable.
- Poster controls remain correctly positioned in LTR and RTL content.
- Repeated motion respects `prefers-reduced-motion`.
- No database, API, auth or dependency surface changes as part of this patch.

## Verification

Run the focused behavior and source gate:

```bash
npm run verify:patch-12
```

Then run the maintained project gates when dependencies and required environment
values are available:

```bash
npm run lint:strict
npm run typecheck
npm run verify:all
```

The Patch 12 gate checks the navigation hierarchy, mobile dock semantics,
cinematic hero composition, poster-card anatomy, RTL-safe overlay placement,
responsive visual tokens, documentation and integration with the maintained
verification runner.

## Rollback

Patch 12 can be rolled back without a data operation:

1. Revert the Patch 12 commit or apply the generated reverse patch.
2. Remove the Patch 12 visual layer from `src/app/globals.css`.
3. Restore the previous Header, Footer, HomeView, MediaCard and MediaRow files.
4. Remove `MobileDock` and `src/lib/navigation-layout.ts`.
5. Remove Patch 12 scripts and documentation entries.

No database restore, migration rollback, cache invalidation or API compatibility
step is required.
