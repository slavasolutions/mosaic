# deep-pages

Page routes nested four levels deep, exercising the "paths under `pages/` become URLs" rule with deep hierarchy.

## What this tests

- Arbitrary route depth: `pages/about/team/history/index.json` → `/about/team/history`
- Folder-shape records at every level (each level has its own `index.md` or `index.json`)
- The `pages/` collection is no different from any other in 0.9 — it is just conventionally routed by engines
- Cascade lookup walks the parent chain (no override actually placed here; that's example 5)

## Expected route table

- `/` → `pages/index.md`
- `/about` → `pages/about/index.md`
- `/about/team` → `pages/about/team/index.md`
- `/about/team/history` → `pages/about/team/history/index.{json,md}` (JSON + body)

## Rules exercised

- Deep route hierarchy via folder-shape records
- Mixing direct-shape (none here) and folder-shape (all of these) freely
- Empty intermediate directories work because each has an `index.*` file; an intermediate folder *without* `index.*` would simply be a URL-prefix container

## What this does NOT yet test

- Any cascade override — see `cascade-override/`
- A "deep route with no intermediate index" — would `pages/a/b/c.md` route to `/a/b/c` even if `pages/a/` has no `index.*`? The brief is silent; assumed yes.
