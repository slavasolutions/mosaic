# @mosaic/core

Shared Mosaic 0.8 SDK. The functions in this package are the reference implementation of the spec's walk → ref-resolve → index-build pipeline. Every other tool in this repo (`validate`, `render`, `astro-loader`) depends on `@mosaic/core` for these primitives.

**Design:**

- **Zero runtime dependencies** beyond `node:fs` and `node:path`. Matches the rest of the reference tools — no `marked`, no JSON Schema engine, no chalk.
- **ESM only**. `import { ... } from '@mosaic/core'`.
- **Pure functions wherever possible.** Inputs are paths or already-loaded objects; outputs are data. No global state.

## Public API

| Function | Purpose |
|---|---|
| `loadSite(path)` | Walk a Mosaic folder and return the in-memory site (pages, collections, singletons, assets, tokens, routes, redirects, diagnostics, plus internal adapter fields). |
| `validateFields(site, diagnostics)` | Run the schema-driven field validators (`mosaic.field.*`, `mosaic.title.dead-h1`, `mosaic.asset.orphan`). Operates on a site already produced by `loadSite`. |
| `validateSite(path)` | Convenience: `loadSite` + `validateFields`, returns the sorted diagnostics array. Async. |
| `getRecord(site, collection, slug, { locale? })` | Look up one record; project to a locale view. |
| `getSingleton(site, name, { locale? })` | Look up one singleton; project to a locale view. |
| `resolveRef(site, refString, { contextDir? })` | Parse + resolve a ref string. Returns a `$ref`/`$asset`/`$rel` stub per SPEC §5.8 (with `value` extras for selector-resolved scalars). |
| `walkRefs(record, cb)` | Visit every ref inside a record's JSON. |
| `emitIndex(site)` | Serialize the site to the SPEC §7.1 normative index shape. |
| `Diagnostics` | Accumulator class. `.structural()`, `.drift()`, `.warning()`, `.summary()`, `.sorted()`. |

Plus lower-level helpers exported for adapters that need them: `parseRef`, `looksLikeRef`, `walkStringValues`, `resolveSelector`, `headingSlug`, `firstH1`, `allHeadings`, `hasFrontmatter`, `extractMarkdownSection`, `resolveTitle`, `splitLocaleStem`, `resolveSiteLocales`, `resolveTranslatable`, `deepMerge`, `deepClone`, `SLUG_RE`, `RESERVED_ROOT`, `isReservedRootName`, `enumerateRecords`, `enumeratePageTree`, `locateSingleton`, `walkAssets`, `buildRecord`, `loadManifest`, `validateManifestShape`, `buildRoutes`.

## Example

```js
import { loadSite, validateFields, emitIndex, getRecord, resolveRef } from '@mosaic/core';

const site = loadSite('/path/to/my-mosaic-site');
validateFields(site, site.diagnostics);

const record = getRecord(site, 'news', '2025-launch');
console.log(record.title, record.body);

const stub = resolveRef(site, 'ref:team/anna@contact.email');
// → { $ref: 'team/anna', url: '/team/anna', title: 'Anna', selector: 'contact.email', value: 'anna@...' }

const json = emitIndex(site);
console.log(json.routes);
```

## Used by

- `@mosaic/validate-ref` (`tools/validate`) — CLI validator.
- `@mosaic/render-ref` (`tools/render`) — wireframe HTML renderer.
- `@mosaic/astro-loader` (`tools/astro-loader`) — Astro Content Collections adapter.
