# flat-collections

Root has three collections directly — `news/`, `team/`, `services/` — with **no `collections/` parent wrapper**. This is the 0.9 simplification: any non-reserved root folder is a collection.

## What this tests

- "Every folder at root = a collection named by folder" rule
- Three collections coexist at root alongside `pages/`
- Pages mount each collection via `collection-list` sections
- The homepage mounts two collections with `routes: false` (preview tiles)
- Detail pages mount the same collections with full routing

## Expected route table

- `/` → `pages/index.json` (homepage preview)
- `/news` → `pages/news.json` (collection list)
- `/news/2026-spring-hours` → minted by the `/news` mount
- `/news/2025-flu-vaccines` → minted by the `/news` mount
- `/team` → `pages/team.json`
- `/team/dr-yusuf-ahmed`
- `/team/nurse-elena-park`
- `/services` → `pages/services.json`
- `/services/dental-care`
- `/services/vaccinations`
- `/services/surgery`

## Rules exercised

- Non-reserved root folders are collections (no `collections/` wrapper required)
- Collection references in `from:` use the `/`-absolute anchor (`/news`, not `collections/news`)
- The homepage uses `routes: false` to avoid colliding with the dedicated list pages
- Cascade is shallow here — no overrides — so each record resolves from its own JSON only
