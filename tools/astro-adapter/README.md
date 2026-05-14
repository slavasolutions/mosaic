# @mosaic/astro-adapter

Astro integration that exposes a [Mosaic 0.8](../../spec/SPEC.md) site as a queryable content store.

This is an **embedded engine** in the spec sense (§0.2): Astro owns routing and rendering; the adapter publishes the Mosaic route table to Astro and exposes the parsed index to `.astro` pages.

## Install

This package is shipped inside the spec repo for the time being. Link it locally:

```json
{
  "dependencies": {
    "@mosaic/astro-adapter": "file:../../tools/astro-adapter"
  }
}
```

Astro `^4` is a peer dependency.

## Use

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import mosaic from '@mosaic/astro-adapter';

export default defineConfig({
  integrations: [
    mosaic({
      site: '../my-mosaic-site',   // path to the Mosaic folder
      base: '/'                     // optional URL prefix
    })
  ]
});
```

You **must** provide a catch-all page at `src/pages/[...slug].astro`. The adapter injects every Mosaic route (pages + collection record routes + redirects) and routes them all through that file. Your catch-all decides how to render each kind of node.

```astro
---
// src/pages/[...slug].astro
import { getMosaicSite } from '@mosaic/astro-adapter/runtime';
const site = await getMosaicSite();
const url = '/' + (Astro.params.slug ?? '');
const route = site.routes[url] ?? site.routes['/'];

let page = null;
let record = null;
if (route?.kind === 'page') page = site.pages[route.target];
if (route?.kind === 'record') {
  const [cname, slug] = route.target.split('/');
  record = site.collections[cname]?.records?.[slug];
}
---
<html>
  <body>
    {page && <h1>{page.data.title}</h1>}
    {record && <h1>{record.title}</h1>}
  </body>
</html>
```

## What the adapter does

1. **Loads** the Mosaic folder per SPEC §7.2 — manifest, assets, singletons, collections, pages, routes, redirects, refs.
2. **Validates.** Any structural diagnostic aborts the build with the error code (`mosaic.xxx.yyy`). Drift and warnings are logged.
3. **Surfaces routes to Astro.** Every page URL and every collection-list–minted record URL becomes an `injectRoute()` call. Redirects (including the automatic `/home → /`) become Astro `redirects` config entries.
4. **Exposes the index** to `.astro` files through a Vite virtual module (`virtual:mosaic-site`). The `runtime` export wraps that with helpers.

## What the adapter does NOT do

- Decide how content is rendered. The catch-all page handles that.
- Auto-render markdown to JSX. The index gives you `record.body` (raw markdown) and `record.bodyHtml` (pre-rendered HTML); your component picks.
- Try to map Mosaic types onto Astro Content Collection schemas. Mosaic types travel as plain JSON; you read them as data.

## Runtime API

```js
import {
  getMosaicSite,   // -> the full index
  getPage,         // (url)               -> page record
  getCollection,   // (name)              -> array of records
  getRecord,       // (collection, slug)  -> one record
  getSingleton,    // (name)              -> singleton record
  getRoute         // (url)               -> route entry
} from '@mosaic/astro-adapter/runtime';
```

The index shape mirrors SPEC §7.1. Adapter additions:

- `record.bodyHtml` — pre-rendered HTML of the markdown body (via `marked`).
- `record.title` — the resolved title per §2.3.

Refs are emitted as stubs per §5.8. Walking record JSON, you'll find:

```js
{ "$ref": "team/anna",       "url": "/team/anna",     "title": "Anna Kovalenko" }
{ "$asset": "images/hero.jpg", "width": 1920, "height": 1080, "alt": "..." }
{ "$rel": "./hero.jpg",       "path": "collections/news/2025-05-15-recap/hero.jpg" }
```

## Dev experience

In `astro dev`, the adapter watches the Mosaic folder and triggers a full reload on any change. Sub-second iteration.

## Status

POC quality. Tracks SPEC §0–§10. Cross-checked against `tools/validate/impl` for diagnostic codes.
