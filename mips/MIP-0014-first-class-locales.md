# MIP-0014: First-class locales

- **Status:** shipped (0.8.1)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.8.1

## Summary

First-class localization in Mosaic via two orthogonal mechanisms:

1. **Translatable fields.** A field value `{ "$type": "translatable", "values": { "<locale>": <value>, ... } }` maps locales to per-locale content for that one field.
2. **Locale-suffix records.** A file `<slug>.<locale>.{md,json}` is the per-locale variant of `<slug>.{md,json}` in the same directory.

Adds `defaultLocale` and `locales` to `mosaic.json#site`. Engines resolve per-locale content against the active locale, falling back to the default, and emit `mosaic.locale.missing` when no value is available.

This replaces the 0.8 stopgap where the interactive migrator stashed per-locale data under engine-namespaced fields (`$astro.translations.uk`, `$astro.localized`) and required every consumer to invent its own rendering convention.

## Motivation

clear-ucc and many real Astro / Next / Hugo sites store translatable content two ways:

1. **Field maps** — `{ "title": { "en": "About", "uk": "Про нас" } }` inside one record's JSON.
2. **Filename suffixes** — `posts/launch.uk.md` alongside `posts/launch.md`, where the suffix is a BCP 47 locale tag.

Mosaic 0.8 has neither. The interactive migrator preserves both via the `$astro.*` engine-extension namespace (MIP-0009 round-trip guarantee). That works for storage but is invisible to the spec: every consumer reinvents how to render the Ukrainian title, every renderer has to know about `$astro.translations`, and the locale story is tied to one engine's convention.

clear-ucc reached the boundary first. Its 354-record migration left every UK translation parked under `$astro.translations.uk` on the EN record, so a fork that wires up `@mosaic/astro-loader` at `/uk/news/<slug>` renders the EN body because the loader has no mechanism to surface the UK sibling. The hot fix is a spec amendment, not an engine workaround — without it every multilingual Mosaic site has the same problem.

The cost of fixing it is one MIP and a small grammar extension. The benefit is renderers, adapters, editors, and migrators all agree on what "the Ukrainian title" looks like.

## Specification

The following text is normative and slots into SPEC.md as the source of truth. SPEC.md will carry the short version pointing back here; this is the long version.

### 14.1 `mosaic.json#site.defaultLocale` and `site.locales`

`site` (§8.2) gains two optional fields:

```json
"site": {
  "name": "string (required)",
  "locale":        "BCP 47 tag (optional, legacy)",
  "defaultLocale": "BCP 47 tag (optional)",
  "locales":       ["<BCP 47 tag>", ...] // optional
}
```

| Field | Type | Required | Default | Meaning |
|---|---|---|---|---|
| `defaultLocale` | string | no | value of `locale` if present, else `"en"` | The active locale when none is requested and the fallback target for missing translations. |
| `locales` | array of string | no | `[defaultLocale]` (single-locale site) | All locales the site ships content for. |

Rules:

- If `locales` is declared, `defaultLocale` MUST be one of its entries.
- The legacy `locale` field is preserved verbatim for round-trip safety (MIP-0009). Engines SHOULD prefer `defaultLocale` when both are present.
- `mosaic.locale.invalid` (drift): a locale-suffix file or translatable-field key whose locale tag is not in `site.locales`.

### 14.2 Translatable fields

A field whose value is an object of exactly the shape:

```json
{ "$type": "translatable", "values": { "<locale>": <value>, ... } }
```

is a **translatable field**. The `<value>` per locale MAY be any JSON value (string, number, object, array). Mixing scalar and structured values across locales for the same field is permitted; engines preserve each locale's value verbatim.

Resolution at active locale `L`:

1. If `values[L]` exists, use it.
2. Otherwise, if `values[site.defaultLocale]` exists, use it AND emit `mosaic.locale.missing` (warning) naming `L` and the field path.
3. Otherwise, pick any present locale value (deterministic order: `Object.keys` order of `values`) AND emit `mosaic.locale.missing` (warning).

Translatable fields are recognized **structurally** by the `$type: "translatable"` marker. The marker is reserved; engines MUST NOT treat any other `$type` value as a translatable field. (`$type` outside this construct keeps its DTCG meaning per SPEC §10.)

Translatable values MAY contain refs (`ref:`, `asset:`, `./`). Engines resolve refs after picking the locale-specific value, against the JSON file that contains the field.

### 14.3 Locale-suffix records

A file `<slug>.<locale>.{md,json}` in the same directory as `<slug>.{md,json}` is the **per-locale variant** for `<locale>`. The grammar in SPEC §2.5 is amended:

```
recordFilename = slug ( "." locale )? "." ext
slug           = [a-z0-9][a-z0-9-]*
locale         = BCP 47 tag listed in site.locales
ext            = "md" | "json"
```

Filename parsing strips the extension first, then checks for a `.<locale>` suffix where `<locale>` matches one of `site.locales`. If the trailing segment after the last `.` is not a known locale, the filename is treated as a non-localized record (the segment is part of the slug, subject to slug-grammar rules per §2.5).

Examples for a site with `site.locales: ["en", "uk", "fr"]`:

| File | Slug | Locale |
|---|---|---|
| `collections/news/launch.md` | `launch` | (no suffix) |
| `collections/news/launch.uk.md` | `launch` | `uk` |
| `collections/news/launch.en.json` | `launch` | `en` |
| `collections/news/2025.summary.md` | `2025.summary` (slug rejected by §2.5 — contains `.`) | (no suffix; the `.summary` segment is part of the stem and is rejected) |

Locale-suffix files MAY appear alongside the non-suffixed file or stand alone. A `<slug>.<locale>.md` with no `<slug>.md` sibling is still a record; its locale is the only locale that has content for `<slug>`.

`mosaic.locale.invalid` (drift) fires for a suffix whose locale isn't in `site.locales`.

### 14.4 Resolution algorithm

For a logical record `<slug>` in a directory at active locale `L`:

1. **Start JSON.** If `<slug>.json` exists, use its parsed contents as the base JSON.
2. **Layer per-locale JSON.** If `<slug>.<L>.json` exists, deep-merge it on top of the base JSON. Per-locale keys win at field granularity. Engines MUST preserve any unknown keys (MIP-0009).
3. **Body.** Use `<slug>.<L>.md` if it exists; else `<slug>.md`; else no body.
4. **Resolve translatable fields.** For any field value still in `{ "$type": "translatable", "values": {...} }` shape, pick `values[L]`; fall back to `values[defaultLocale]` with `mosaic.locale.missing` (warning); else first-available with `mosaic.locale.missing`.
5. **Title precedence (§2.3) runs against the resolved record** (post-merge and post-translation). Required-title checks (MIP-0010) use the resolved title.

The merge in step 2 is a deep merge: nested objects are recursively merged; arrays are replaced (per-locale array fully overrides base array). This matches the principle "per-locale wins at field granularity" without introducing array-merge ambiguity.

### 14.5 Index shape changes

Each entry in `pages`, `collections.<name>.records`, and `singletons` gains:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `locales` | array of string | yes | All locales that have at least one source file for the record (`<slug>.<L>.{md,json}` or `<slug>.{md,json}` ⇒ defaultLocale). Sorted; `defaultLocale` always present if any source exists. |

Engines that surface per-locale variants MAY also emit `entriesByLocale` or equivalent (non-normative).

Loaders for embedded engines (Astro, Next, etc.) MAY expose one Astro entry per `(slug, locale)` combination, with a synthesized `id` of `"<slug>--<locale>"` for non-default locales (recommended) — but the index itself is locale-neutral; the per-locale view is a presentation choice.

### 14.6 Diagnostic additions

| Code | Severity | When |
|---|---|---|
| `mosaic.locale.missing` | warning | Translatable field has no value for the requested locale and no defaultLocale value either, OR fell back to defaultLocale instead of the requested locale. |
| `mosaic.locale.invalid` | drift | A locale-suffix file or translatable-field key uses a tag not in `site.locales`. |
| `mosaic.locale.unknown-default` | drift | `mosaic.json#site.defaultLocale` is not in `site.locales`. |

### 14.7 What stays out of scope

- **Locale-prefixed URL routing** (`/uk/about`). Engine concern; routing MIPs handle it (different cluster).
- **RTL hint propagation.** Engine concern.
- **Per-locale asset variants** (`hero.uk.jpg`). Use translatable fields with `asset:` ref values to achieve the same effect explicitly.
- **Per-section translations** beyond translatable fields inside sections.

## Rationale and alternatives

clear-ucc's source data shows the two storage shapes side by side. The migrator picked engine-extension preservation because it was the only legal Mosaic-0.8 move; once we promote both shapes to first class the engine-extension trick is no longer needed.

### Why ship both mechanisms

- **Translatable fields** have low friction for small per-record overrides (one Ukrainian heading on an otherwise English page; a localised CTA label).
- **Locale-suffix files** have low friction for full-record translations where the markdown body is the bulk of the content (news articles, blog posts).

Forcing every site to use one shape would push the other shape into engine extensions again. Both are real authoring patterns; both belong in the spec.

### Considered alternatives

**A. Engine extensions only.** Today's behavior. Rejected — every consumer reinvents rendering; the spec is silent on the most common multilingual pattern.

**B. Translatable fields only (no suffix files).** Rejected — forces authors with long markdown bodies into a single JSON file with the body as a string field. Loses syntax highlighting, diff readability, and the markdown-first authoring story.

**C. Locale-suffix files only (no translatable fields).** Rejected — forces a whole record to be duplicated to override a single Ukrainian word. The per-field map is the right tool for small overrides.

**D. Field-level locale maps without a `$type` marker** — `{ "title": { "en": "...", "uk": "..." } }`. Rejected — ambiguous with arbitrary object-typed fields (a record with a `contact: { en: ..., fr: ... }` map of emails per region is plausible). The `$type: "translatable"` marker disambiguates structurally.

**E. Inline locale prefix on string values** — `"@uk:Про нас @en:About"`. Rejected — invents a string microsyntax for something the JSON object shape can express directly.

### Why `$type` and not a top-level reserved field

Mosaic already reserves `$ref`, `$asset`, `$rel`, `$value`, `$type` per SPEC §0.2. The DTCG token format uses `$type` on token nodes. Re-using the same sigil keeps the namespace tight (one set of reserved keys, one mental model).

The `$type: "translatable"` shape is structurally distinct from DTCG tokens (which always have a `$value`, never a `values` map), so there's no collision in practice.

## Drawbacks

**Two mechanisms double the authoring surface.** Authors now choose between locale-suffix files and translatable fields. Migrators have to detect both shapes from source. Editors have to render both shapes. Documentation has to explain both.

Mitigation: the two shapes optimise for different scales — locale-suffix for full-record translations, translatable fields for in-record overrides. Once the rule of thumb is internalized, the choice is mechanical.

**The resolution algorithm has an order.** Engines that diverge on merge semantics (deep vs shallow, array merge vs replace) will produce different outputs. The spec pins deep-merge + array-replace; non-conforming engines will surface as drift in the index walk-through tests.

**`mosaic.locale.missing` is a warning, not drift.** Soft-failing on missing translations matches the "fall through to default" intuition but means a site that's silently English-only at `/uk/<slug>` won't fail validation. Authors who want strict coverage can enable `--strict` on their validator.

**Locale-suffix files complicate the slug grammar.** §2.5 was a clean regex; now it has a two-pass parse (extension, then optional locale). The regex itself is unchanged for slugs; the wrapper around it grows.

## Open questions

**Should `defaultLocale` be required when `locales` is set?** Resolution: **yes** (codified above). A multi-locale site without a designated default has no well-defined fallback, so the resolution algorithm would need a fallback-of-fallbacks. Cleaner to require the author to pick.

**Should locale-suffix files and translatable fields coexist on the same record?** Resolution: **yes**. They operate at different layers (record vs field). A `news/launch.uk.md` body alongside a translatable `category` field on the same record's JSON is a legitimate authoring pattern.

**What if both `site.locale` and `site.defaultLocale` are present?** Resolution: `defaultLocale` wins. `locale` is preserved verbatim per MIP-0009 but is treated as legacy.

**Should engines surface per-locale Astro entries automatically?** Resolution: **out of scope for the spec.** The loader chooses; the spec only mandates the index `locales` field. The `@mosaic/astro-loader` reference implementation emits one entry per (slug, locale).

## Resolution

Shipped in 0.8.1. clear-ucc migration adopted on the same release.
