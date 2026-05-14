# @mosaic/astro-loader

Generic [Astro Content Loader](https://docs.astro.build/en/reference/content-loader-reference/) for [Mosaic 0.8](../../spec/SPEC.md) folders. Each Mosaic collection becomes one Astro collection; singletons are read via runtime helpers.

This is the **embedded-engine** sibling of `@mosaic/astro-adapter`. The adapter takes over routing; this loader just feeds Mosaic content into Astro's existing content-collections plumbing and lets you keep your `.astro` pages, schemas, and routes exactly as they are.

## Install

```json
{
  "dependencies": {
    "@mosaic/astro-loader": "file:../../tools/astro-loader"
  }
}
```

Astro `^4 || ^5 || ^6` is a peer dependency.

## Use — per-collection loader

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { mosaicLoader } from '@mosaic/astro-loader';

const SITE = '/abs/path/to/my-mosaic-site'; // or path relative to project root

const news = defineCollection({
  loader: mosaicLoader({ site: SITE, collection: 'news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string().optional(),
    featuredImage: z.string().optional(), // see "Image handling" below
    // ...whatever your Mosaic records have
  }),
});

export const collections = { news };
```

Every record's `data` is the record's locale-resolved JSON merged with these convenience fields:

| Field | Description |
|---|---|
| `body` | Raw markdown body for the entry's locale (empty string when no `.md` file) |
| `url` | Spec-computed URL or `null` if the collection is unrouted |
| `slug` | The record's slug (matches the Astro entry `id` minus any locale suffix) |
| `locale` | BCP 47 tag for this entry's locale |
| `locales` | All locales the record ships content for |
| `mosaic` | `{ shape, files, title, locale, defaultLocale }` for tools that care |

If your schema declares fields that don't exist in the Mosaic record, Zod will throw — adjust your schema to match Mosaic's field names.

### Locales (MIP-0014)

The loader emits **one Astro entry per `(slug, locale)` combination**:

- Default-locale entries keep `id = "<slug>"` (back-compat for single-locale sites).
- Other-locale entries use `id = "<slug>--<locale>"`.

Every entry carries `data.locale`. Consumers route per locale by filtering or by id:

```ts
const ukNews = await getCollection('news', e => e.data.locale === 'uk');
// or
const post = (await getCollection('news')).find(e => e.id === 'launch--uk');
```

A single Zod schema validates every locale because:

- **Per-locale JSON sidecars** (`<slug>.<locale>.json`) are deep-merged on top of `<slug>.json` before the schema sees the entry.
- **Translatable fields** (`{ "$type": "translatable", "values": { "en": "...", "uk": "..." } }`) are resolved to the entry's locale before the schema sees the entry.

Authoring rule of thumb:
- Full-record translation → drop `<slug>.<locale>.md` next to `<slug>.md`.
- Per-field translation → use `$type: "translatable"` in any JSON field.

Mosaic does not own URL routing. If your site needs `/uk/news/<slug>`-style URLs, build that in your Astro `getStaticPaths` using `data.locale`.

## Use — singletons

Astro Content Collections don't have a singleton concept. Reach for the runtime helpers instead:

```astro
---
// src/layouts/Base.astro
import { getSingleton, getMessages } from '@mosaic/astro-loader/runtime';

const SITE = '/abs/path/to/my-mosaic-site';
const header = await getSingleton(SITE, 'header');
const footer = await getSingleton(SITE, 'footer');
const messages = await getMessages(SITE);
---
<header>
  {header.data.nav.map((item) => <a href={item.url}>{item.label}</a>)}
</header>
<main><slot /></main>
<footer>{footer.data.copyright}</footer>
```

Available helpers:

- `getSingleton(site, name)` — full record (`.data`, `.body`, `.bodyHtml`, `.title`)
- `getSingletonData(site, name)` — just the JSON payload
- `getMessages(site)` — shorthand for the `messages` singleton (paraglide-style i18n bag)
- `getPage(site, url)` — page record by URL
- `getRecord(site, collection, slug)` — direct record lookup
- `getMosaicIndex(site)` — the full SPEC §7.1 index
- `getManifest(site)` — `mosaic.json` verbatim
- `renderMarkdown(md)` — same renderer the loader uses for bodies

The first call per site path loads and caches the full index; subsequent calls are free.

## Image handling

Mosaic stores binary assets under `images/` and addresses them via `asset:images/path.jpg` refs. Astro's `image()` schema helper expects either a static `import` or an Astro-owned routed asset path — neither matches a Mosaic ref.

The loader **flattens `asset:` refs to URL strings** before validation. Default behavior: `asset:images/news/hero.jpg` becomes `/images/news/hero.jpg`. So your schema should use plain strings:

```ts
schema: z.object({
  featuredImage: z.string().optional(),   // not image()
})
```

To make those URLs actually serve, copy the Mosaic site's `images/` directory into Astro's `public/images/` directory (or symlink it). Two ways:

1. **One-shot copy** during `prebuild`. Add a script.
2. **Symlink** `public/images` → `<mosaic-site>/images`. Simplest in dev.

Override the prefix via the `assetBase` option:

```ts
mosaicLoader({ site: SITE, collection: 'news', assetBase: '/cdn-images/' })
```

## What this loader does NOT do

- It does not rename Mosaic field names to match your existing schema. If your old schema used `publishedAt` but Mosaic has `date`, change the schema; the loader stays vocabulary-neutral.
- It does not take over routing. URLs are still owned by your `.astro` pages.
- It does not surface Mosaic redirects to Astro. You declare those in `astro.config.mjs#redirects` separately (or use `@mosaic/astro-adapter` if you want a full handoff).
- It does not pre-render markdown to MDX. `data.body` is raw markdown; if you need rendered HTML, the loader fills Astro's `rendered.html` slot from `record.bodyHtml`, so `await entry.render()` works.

## Refs in record JSON

Refs inside a record's JSON are resolved per SPEC §5.8 and arrive as stubs:

```js
{ "$ref": "team/anna", "url": "/team/anna", "title": "Anna Kovalenko" }
{ "$asset": "images/hero.jpg", "alt": "...", "width": 1920, "height": 1080 }
{ "$rel": "./hero.jpg", "path": "collections/news/2025-05-15-recap/hero.jpg" }
```

Top-level `$asset` stubs are auto-flattened to a URL string (see "Image handling"). Nested `$ref` and `$rel` stubs pass through as-is — your component decides how to render them.

## Idempotency

Two `astro dev` invocations against the same Mosaic folder produce identical store contents. The loader clears stale entries on each `load()` so file deletions in the Mosaic folder propagate.

## Testing

```bash
cd tools/astro-loader
node test.js   # smoke-tests load() against the test fixture
```
