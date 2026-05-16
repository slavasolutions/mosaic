# edge-case-mixed

The integration stress test. Combines:

- deep page hierarchy (`pages/programs/stories/index.json`, 3 levels)
- cascade override (root `header.json` + override at `pages/programs/header.json`)
- locale variants (`site.uk.json`, `pages/index.uk.md`, `header.uk.json`, `programs/stories/2026-04-borys-zhuravel.uk.md`)
- extension fields (`x-astro.layout`, `x-clearcms.editorial_status`)
- extension sidecar (`site.x-clearcms.json`)
- DTCG tokens with `ref:tokens@…` consumers
- a collection (`programs/stories/`) that lives inside a non-pages collection-named folder mounted by a deep page
- a regular `artists/` collection (currently unmounted — would emit `mosaic.collection.unmounted` warning)

## What this stresses

### 1. Cascade + locale interplay

`pages/programs/stories/index.json` resolves `ref:header` at active locale `uk`:

1. Cascade lookup: closest `header.json` is at `pages/programs/header.json`.
2. Locale resolution on **that** record: is there `pages/programs/header.uk.json`? No. So the base `pages/programs/header.json` wins.
3. But the **root** `header.uk.json` exists. Should it merge in? **The spec is silent.** Three readings:
   - **(a) Cascade beats locale.** Closest header wins outright; root locale variant is irrelevant because the closer file shadowed it.
   - **(b) Locale beats cascade.** Resolve locale at each layer separately, then cascade-merge the locale-resolved layers.
   - **(c) Locale + cascade are independent passes.** Pick one order.
   
   This example assumes (a) is the locked behavior — cascade wins, locale variants only apply to the cascade-selected file. **Major friction point**, captured in REPORT.md.

### 2. Cross-collection refs from non-pages

`programs/stories/2026-04-borys-zhuravel.json` references `ref:header`. The cascade walk from `programs/stories/` goes: `programs/stories/` → `programs/` → root. No `pages/programs/header.json` on that walk (different parent chain). So this record resolves to **root** `header.json`, not the programs-specific one.

This is a counterintuitive consequence of "every folder = collection" plus "cascade walks parent chain": the same `ref:header` resolves differently depending on whether the consumer is in `pages/programs/` (gets the programs header) or in `programs/stories/` (gets the root header). A renderer that displays both side-by-side will show inconsistent navigation.

### 3. Stories live in TWO places

The `pages/programs/stories/index.json` page mounts collection `/programs/stories`. The actual records live in `programs/stories/`. The path `/programs/stories` is both:
- A URL prefix (because `pages/programs/stories/` exists)
- A collection address (because `programs/stories/` exists)

The `from: "/programs/stories"` in the collection-list must resolve to the **filesystem path** `/programs/stories`, not to the URL `/programs/stories`. The two coincide here, but they are conceptually distinct, and the brief's "`/` absolute anchor" doesn't say which namespace `/` is rooted in.

### 4. Translation status as a sidecar field

`site.x-clearcms.json` declares `translationStatus.uk = "complete-2026-04"`. The Mosaic engine doesn't read this; ClearCMS does. But the engine must **preserve** the sidecar file when round-tripping.

### 5. Title fallback for the .uk record

`pages/index.uk.md` has no H1 and no JSON sidecar for the `uk` variant (only `pages/index.uk.md`, no `pages/index.uk.json`). Title resolution at locale `uk`:

1. Locale-merged JSON title? `pages/index.json#title = "Hromada"`. **Yes.**
2. Use it as-is, OR translate via a translatable field? The brief doesn't say. We end up with a Ukrainian body under an English title.

This is a real translation gap — see REPORT.md item #5.

## Expected route table (locale = en)

- `/`
- `/programs`
- `/programs/stories`
- `/programs/stories/2026-04-borys-zhuravel`
- `/programs/stories/2026-02-iryna-bondar`
- `/donate`

Artists collection is unmounted, so its records have `url: null`.
