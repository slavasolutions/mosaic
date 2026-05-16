# extension-sidecar

Engine-specific metadata via the single `x-` namespace marker, in both forms:

## What this tests

- A **sidecar file** `site.x-clearcms.json` attached to record `site.json`. The base record stays Mosaic-pure; ClearCMS-specific data lives in the sidecar.
- **Extension fields** `x-astro.layout` and `x-astro.preload` inside `pages/index.json`. Other engines must preserve them verbatim per forward-safety.

## Locked decision being exercised

> Single namespace marker `x-` for both fields (`x-clearcms.field`) and sidecars (`<slug>.x-clearcms.json`)

Both notational forms share the same marker, which simplifies the mental model: see `x-`, know it's engine extension.

## Friction noticed

The brief writes `$astro.<field>` in one bullet (legacy `$` syntax from 0.8) but `x-clearcms.field` in another. I am using `x-` per the "single namespace marker" locked decision. If `$` is preferred for fields, the locked decision contradicts itself — see REPORT.md.

Also note: a sidecar named `site.x-clearcms.json` introduces **two dots in the filename**. Locale-suffix files use the same pattern (`<slug>.<locale>.json`). The parser must distinguish `x-<ns>` from a `<locale>` tag. Since `x-` is a fixed marker prefix and `<locale>` is a BCP 47 tag from `site.locales`, this is decidable but the spec should call it out.

## Expected behavior

- ClearCMS engines merge the sidecar onto the base record, possibly under a namespaced field (e.g. `_meta.clearcms`) — exact placement is engine-defined.
- Non-ClearCMS engines preserve the sidecar file on disk unchanged when they round-trip the site.
- Non-Astro engines preserve `x-astro.layout` and `x-astro.preload` in the page JSON.
