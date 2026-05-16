# locale-variants

Bilingual site (en + uk) using locale-suffix files per MIP-0014.

## What this tests

- `mosaic.json#site.locales` declares both locales
- Locale-suffix file form: `<slug>.<locale>.{md,json}` per MIP-0014
- Coverage of the three combinations:
  - **JSON-only override** — `site.uk.json` overrides `site.json` `name` and `tagline`; `address` not present in `.uk` form, so the base value carries through (deep-merge objects).
  - **MD-only override** — `pages/about.uk.md` overrides `pages/about.md`; `pages/about.json` is shared across locales.
  - **Both** — `pages/index.uk.{json,md}` overrides both base files.
- Collection records also use locale variants: `events/2026-poetry-night.uk.json` overrides `events/2026-poetry-night.json`.

## Resolution algorithm (per MIP-0014, restated)

For active locale `L`:

1. Start with the base record JSON.
2. Deep-merge `<slug>.<L>.json` if present.
3. Body = `<slug>.<L>.md` if present, else `<slug>.md`, else none.

## Friction noticed

1. The 0.9 brief drops `mosaic.json#singletons` (since "every file at root is a record named by filename"). So `site.json` here is a record-by-filename, not a declared singleton. But `site.uk.json` requires the engine to know `uk` is a locale (from `mosaic.json#site.locales`) to even parse the filename correctly — otherwise it might think there's a record called `site.uk` and another called `site`. The locale-tag-as-name-segment rule has to fire **before** the "file at root = record" rule.

2. Parsing precedence: filename `site.x-clearcms.json` (example 6) vs. `site.uk.json` (here) share the two-dot pattern. The parser order must be:
   1. Strip extension.
   2. Check trailing `.<segment>` against `x-<ns>` (sidecar) and `<locale>` (variant).
   3. If neither matches, the entire stem is the slug.

## Expected URL behavior

The brief says locale-prefixed URL routing is **out of scope**. So with active `uk`:

- `/` still serves `pages/index.{json,md}` resolved at locale `uk`
- No `/uk/` prefix
- Locale selection is an engine concern (header, cookie, etc.)
