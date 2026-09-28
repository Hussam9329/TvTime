# TvTime UI/UX Audit and Redesign

## 1. Product summary

TvTime is a personal viewing companion for movies, standard TV, Asian TV, anime, Arabic movies, and Arabic TV. Its primary value is not catalogue browsing alone: it combines discovery with a personal library, episode progress, watch history, ratings, release schedules, notifications, and statistics.

The redesign therefore treats TvTime as a personal media workspace rather than a generic streaming-service clone.

## 2. Confirmed context and assumptions

### Confirmed

- The product is a responsive Next.js web application.
- Dark mode is the default, with a supported light theme.
- English is the primary shell language.
- Arabic catalogue worlds require true RTL layout and Arabic metadata.
- The core repeat tasks are searching, discovering, opening a title, updating library state, and continuing a TV show.
- The application already has strong data separation between Movies, TV Shows, Anime, Asian TV, Arabic Movies, and Arabic TV.

### Assumptions

- The primary user is the library owner rather than a multi-tenant public audience.
- Desktop is used for deeper browsing and management; mobile is used frequently for quick continuation, search, and status updates.
- The existing cinema-red primary accent remains part of the brand.
- No business conversion funnel or payment flow exists in the current scope.

## 3. Primary users and Jobs To Be Done

### The active viewer

- Wants to continue the correct next episode with minimal thought.
- Needs progress, last activity, and upcoming episodes to be trustworthy.
- Often uses the product from a phone.

**JTBD:** “When I have time to watch something, show me the exact next useful action without making me search my library.”

### The catalogue explorer

- Browses by type, genre, year, rating, language, and viewing state.
- Needs filters that remain powerful without dominating the result grid.
- Compares posters and ratings quickly.

**JTBD:** “When I want something new, help me narrow a large catalogue without losing context or getting trapped in filter controls.”

### The collection curator

- Maintains watchlists, watched states, following states, and ratings.
- Needs strong separation between media worlds.
- Values reliable counts and visible library status.

**JTBD:** “When I update a title, make its state unambiguous everywhere and keep the collection organized.”

## 4. Audit findings

### Critical

1. **Interactive nesting inside media cards**
   - A full-card anchor contained an independent dropdown button.
   - This created invalid interaction semantics, competing click targets, and unpredictable keyboard behavior.
   - Fixed by separating the title link and action menu as sibling controls.

2. **Designed CSS and rendered components were disconnected**
   - The repository contained a newer semantic visual system for the header, home hero, media rows, cards, mobile dock, and footer.
   - The corresponding components still rendered older structures and class names.
   - This produced inconsistent surfaces and left a large amount of design code unused.
   - Fixed by connecting the shared components to the maintained semantic classes.

### High priority

3. **Desktop navigation was overloaded**
   - Nine destinations competed in a single top-level row.
   - Search, notifications, theme, help, profile, and navigation all fought for the same horizontal space.
   - Fixed by keeping the five most frequent destinations visible and grouping secondary worlds under a clear “More” menu.

4. **Mobile navigation required repeated menu opening**
   - Frequent destinations were not reachable one-handed.
   - Fixed with a five-position bottom dock: Home, Watch Next, Movies, TV Shows, and More.

5. **Home statistics had equal visual weight**
   - Eight independent cards appeared as a flat dashboard with no primary continuation action.
   - Fixed by grouping them under one “Your library” overview and giving “Continue watching” explicit priority.

6. **Discover filters dominated mobile**
   - The full filter system appeared before the catalogue, increasing time to first result.
   - Fixed with a compact mobile disclosure that summarizes active filters and expands only when requested.

### Medium priority

7. **Poster cards carried too much footer UI**
   - Type, year, states, and an action row competed with the title.
   - Fixed with a poster-first card: score and library state remain on the image, while the footer contains only title, year, and media world.

8. **Loading, empty, and error states were inconsistent**
   - Discover, Search, and Watch Next used different visual and writing patterns.
   - Fixed by reusing the established feedback and EmptyState language.

9. **Search showed Arabic empty-state copy in an English LTR page**
   - Fixed with English copy that names the active filter in human-readable language.

10. **Optional Sentry integration initialized during unconfigured builds**
    - This caused unnecessary outbound telemetry and prevented a private offline build.
    - Fixed by wrapping the Next.js configuration only when Sentry is intentionally configured.

## 5. Information architecture

### Persistent primary navigation

- Home
- Watch Next
- Movies
- TV Shows
- Anime

### Secondary navigation

- Discover
- Asian TV
- Stats
- Arabic Movies
- Arabic TV

### Global utilities

- Search
- Notifications
- Theme
- Keyboard shortcuts
- Profile and preferences

The hierarchy prioritizes task frequency, while preserving every existing world and route.

## 6. Core user flows

### Continue a show

Home → Continue watching → Watch Next → Open show or mark next episode watched → Queue refreshes

### Discover a title

Media world → Discover → Quick pick or filters → Results → Title details → Add to watchlist / follow / mark watched

### Search

Header search → Search results → Media-world filter → Title/person details

### Manage a collection

Media world → My Library → State tab → Title details or card actions → Updated state and counts

## 7. Chosen visual direction

### Premium cinematic editorial

The selected direction uses:

- Poster-first browsing instead of card-heavy dashboards.
- Deep neutral surfaces with a controlled red brand accent.
- Category personality through a single accent per world.
- Large cinematic imagery only where it carries meaning.
- Quiet glass and elevation treatments for navigation and tools.
- Clear separation between primary actions, utility controls, and metadata.

This direction fits a personal cinema product while remaining implementable in standard HTML, React, and CSS.

## 8. Design system decisions

### Core tokens

- Content width: `90rem`
- Control radius: `0.875rem`
- Card radius: `1.375rem`
- Hero radius: `2rem`
- Section gap: responsive `1.75rem–2.75rem`
- Spacing foundation: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

### Color roles

- Primary: cinema-red semantic token
- TV/Asian accent: teal/cyan semantic chart token
- Anime accent: fuchsia semantic chart token
- Arabic accent: warm amber semantic chart token
- Success: emerald
- Warning/rating: amber
- Destructive: rose/red

Color is never the only state indicator; icons and text labels remain available.

### Typography

- English shell: Geist
- Arabic/RTL fallback stack: Noto Sans Arabic, Noto Kufi Arabic, Tahoma, Arial
- Minimum utility text is normalized to a readable 12px floor.
- Headings use balanced wrapping and stronger weight instead of excessive size.

## 9. Implemented screen and component changes

### Header

- Floating command-bar surface.
- Reduced visible destination count.
- Secondary navigation menu.
- Compact search field.
- Contextual unread notification label.
- One-handed mobile dock.
- Navigation state remains available to assistive technology.

### Home

- Cinematic featured hero with independent contrast.
- Clear featured metadata and two actions.
- Poster support on larger screens.
- Grouped library overview.
- Dedicated Continue Watching CTA.
- Rebuilt recent and curated media rows.

### Media cards

- Poster-first structure.
- Separate semantic title link and action menu.
- TMDB score, watched state, watchlist/following state, and user rating remain visible without expanding the card footer.
- Visible focus treatment and touch-safe controls.

### Discover

- Stronger catalogue header.
- Horizontally scrollable quick picks.
- Collapsible mobile filters.
- Active-filter count and page context.
- Unified retry, loading, and empty states.

### Search

- Clearer search entry surface.
- Unified empty/error patterns.
- Correct LTR English result copy.
- Human-readable filter names.

### Watch Next

- Shared hero and category accent.
- Reusable empty and error states.
- Recovery action for failed queue loading.

### Footer

- Movie and TV viewing totals are presented as separate semantic groups with distinct visual accents.
- Statistics remain a real description list for assistive technology.

## 10. Responsive behavior

### 320–479px

- Compact edge-to-edge header.
- Fixed bottom quick-navigation dock.
- Full-width hero actions.
- Horizontal library statistics and poster rows.
- Discover filters collapsed by default.
- Minimum 44×44px coarse-pointer targets.

### 480–767px

- More poster context per row while retaining touch-safe controls.
- Search remains available from the header.
- Page heroes reduce decoration and padding.

### 768–1279px

- Header search is persistent.
- Full navigation moves into the menu until enough width exists.
- Grid density increases without shrinking labels below the readability floor.

### 1280px and above

- Primary destinations are visible.
- Secondary worlds remain grouped to protect search and utility space.
- Home hero includes a supporting poster.
- Poster grids scale to six or seven columns depending on width.

## 11. Accessibility review

- One primary `h1` remains on Home.
- SPA route changes are announced and focus moves to the main region.
- Skip navigation remains available.
- Media-card action controls no longer nest inside links.
- Focus-visible treatment is preserved across links, buttons, tabs, fields, and cards.
- Mobile touch targets meet the 44px coarse-pointer target.
- Reduced-motion and forced-colors fallbacks remain active.
- RTL is scoped at view level, with logical placement for poster controls.
- Empty states use labelled status regions; blocking failures use explicit recovery copy.

## 12. Edge cases covered

- No search query.
- Search API failure.
- No search results in a specific media-world filter.
- Discover API failure.
- No discover results after filtering.
- Filter controls on narrow screens.
- Long title truncation and two-line card titles.
- Missing poster fallback.
- Missing or invalid detail ID.
- No Watch Next items.
- No announced upcoming episodes.
- Watch Next network failure.
- Touch device with no hover.
- Reduced motion.
- Light theme and dark theme.
- Arabic RTL catalogue views.

## 13. Verification

- TypeScript typecheck: passed.
- ESLint: passed.
- Next.js optimized production compilation: passed.
- User-facing integrity suite: 44 checks passed.
- Patch 11 behavior and source guards: passed.
- Media-world separation suite: 43 checks passed.
- Comprehensive maintained suite: all maintained TvTime suites passed.
- Neon schema verification: attempted read-only; blocked by database connectivity from the execution environment, with no writes performed.

## 14. Self-evaluation

| Criterion | Score |
|---|---:|
| UX clarity | 9/10 |
| Task speed | 9/10 |
| Visual hierarchy | 9/10 |
| Consistency | 9/10 |
| Responsive behavior | 9/10 |
| Accessibility | 9/10 |
| RTL support | 9/10 |
| Implementation quality | 9/10 |
| Scalability | 9/10 |
| State coverage | 9/10 |

## 15. Recommended next priorities

1. Perform authenticated visual regression screenshots at 360px, 768px, 1280px, and 1440px after the branch is deployed to a preview environment.
2. Add automated browser checks for the mobile dock, Discover filter disclosure, card menu keyboard flow, and RTL poster controls.
3. Measure Search-to-Detail, Discover-to-Detail, and Watch-Next completion funnels.
4. Review the detail pages as a dedicated second pass, focusing on season/episode density and primary action placement.
5. Rotate all credentials shared outside the deployment secret stores.
