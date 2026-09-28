# Patch 11 — theme-aware UI foundation

## Objective

Patch 11 is a safe first-pass product-quality patch across the existing TvTime
interface. It removes conflicting global presentation overrides, strengthens
the shared component layer, and makes SPA navigation, feedback states and
Arabic catalogue views more predictable without changing data behavior.

## Audit findings addressed

- The final global CSS block forced dark-only backgrounds, white headings and
  fixed violet/pink treatments after the semantic theme tokens had already
  been defined. That made light mode visually inconsistent and caused shared
  components to behave differently between pages.
- Navigation labels and route accessibility metadata were duplicated in the
  header, so detail views and Arabic views could drift from the actual route.
- Client-side route changes did not announce the new view or move focus to the
  new main landmark.
- Loading, empty and error states were not consistently hidden or described for
  assistive technology.
- Several shared controls had inconsistent target sizes, focus feedback and
  busy/disabled behavior.
- The global recovery screen and view error boundary needed safer production
  copy and clearer recovery actions.

## Delivered changes

### Theme and visual consistency

- Replaced the dark-only override block with semantic application surface,
  border, shadow, hero, skeleton and header tokens.
- Added complete dark and light token variants, including `color-scheme`.
- Added semantic high-contrast foreground tokens for primary and destructive solid controls.
- Kept the cinematic visual language while limiting elevation and hover motion
  to interactive surfaces.
- Added fallbacks for browsers without `backdrop-filter`, forced-colors mode,
  reduced motion and coarse pointers.
- Made the home hero contrast independent of the selected theme.
- Added safe-area handling and short-screen constraints for shell and portal
  surfaces.

### Shared components

- Normalized Button, Input, Textarea and Select sizing, radius, focus and state
  behavior without adding a dependency.
- Made Skeleton decorative by default.
- Made EmptyState a labelled, reusable status region.
- Improved reusable error and recovery states while keeping technical details
  development-only.

### Navigation, language and RTL

- Added one `VIEW_METADATA` registry for visible labels, accessible labels,
  route announcements, language and direction.
- Applied `lang` and `dir` to the main content region while keeping the
  application chrome LTR.
- Added a polite route announcer and focus restoration to `<main>` after
  client-side navigation.
- Preserved a working skip link and explicit document direction.
- Added an Arabic system-font fallback and logical RTL handling without a
  network font dependency.

### Header, footer and home

- Added dynamic disclosure labels/states for mobile navigation and search.
- Included unread notification state in the notification control name.
- Centralized current-page labels and added the missing person-detail label.
- Converted footer statistics to semantic description-list data.
- Reduced the home hero to one primary heading and added an accessible loading
  state for recently watched media.
- Improved focus visibility and target behavior for card overlays and quick
  actions.

### PWA metadata

- Corrected the application icon to `/logo.svg`.
- Added stable manifest identity, language, direction and categories.
- Declared support for both light and dark browser color schemes.

## Compatibility and risk

- No database migration.
- No API contract change.
- No Prisma schema change.
- No authentication or authorization behavior change.
- No dependency added or upgraded.
- Existing routes, stores, query keys and media mutation handlers are preserved.

The patch intentionally changes the shared visual foundation rather than
rewriting individual feature pages. Existing page-specific classes continue to
work, but the final semantic layer now resolves conflicts consistently.

## Verification

Run the focused source and behavior gate:

```bash
npm run verify:patch-11
```

Then run the maintained project gates after dependencies and required
environment values are available:

```bash
npm run lint:strict
npm run typecheck
npm run verify:all
```

The Patch 11 gate verifies route metadata coverage, theme tokens, mobile target
sizes, reduced-motion and forced-colors fallbacks, SPA announcements, shared
state semantics, safe error disclosure, manifest metadata and documentation.

## Rollback

Patch 11 can be rolled back without a data operation:

1. Revert the Patch 11 commit or apply the generated reverse patch.
2. Restore the previous `src/app/globals.css` final override block.
3. Remove `src/lib/view-metadata.ts` and restore the former header/AppShell
   route labels.
4. Remove the Patch 11 verification entries from `package.json` and
   `scripts/verify-all.mjs`.

No database restore, cache invalidation or API compatibility step is required.
