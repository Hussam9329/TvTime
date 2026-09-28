# Styles

`src/app/globals.css` is only an import manifest. Every rule lives in a partial
under this folder, and **import order is cascade order**:

| Group | Folder | Owns |
|---|---|---|
| Base | `base/` | Tokens (`@theme`, custom properties), element defaults, utilities, keyframes |
| Layout | `layout/` | App shell, header, mobile dock, footer |
| Components | `components/` | Shared building blocks: media cards, shelves, filters, feedback states, overlays, controls |
| Pages | `pages/` | View-specific styles (Home, Watch Next, detail, world hubs, library, discover…) |
| Overrides | `overrides.css` | Cross-cutting refinements that must win over several areas |
| Late layers | `themes/cinema.css`, `pages/catalogue-layout.css`, `pages/media-profile.css` | Loaded last, as before the split |

Views that own a large, self-contained stylesheet keep it next to the component
(`components/views/home-view.css`, `components/views/watch-next.css`).

## Adding or changing a rule

1. Put it in the partial that owns the selector's subject (e.g. `.tvtime-media-card…` → `components/media-card.css`).
2. Prefer design tokens (`var(--primary)`, `var(--border)`, the radius and spacing tokens in `base/tokens.css`) over literal values.
3. Avoid `!important`. If a rule only works with it, something earlier is too specific — fix that instead.
4. Before moving an existing rule from `overrides.css` into an area file, check that no earlier-imported rule sets the same property on the same elements; the move changes cascade order.

## Guards

Source-guard scripts read the combined stylesheet through
`scripts/lib/read-styles.mjs`, which inlines these partials in import order.
