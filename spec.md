# Mosaic — normative specification

**Version:** 0.1 (draft)
**License:** CC0 1.0 Universal
**Reference implementation:** [Clear](https://github.com/clearcms/clear)

This document is the normative spec for Mosaic. The [README](./README.md) is the introduction + anatomy + format reference; this file is the validator's-eye view: closed taxonomies, conformance levels, resolution algorithms, edge cases.

Keywords: **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY** follow [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

---

## 1. Conformance levels

Implementations claim a **conformance level**. A Mosaic-conformant implementation MUST clearly document its level.

### Level 1 — Reader

An implementation that consumes Mosaic and renders or processes the content. MUST:
- Parse the file tree per §3
- Validate `mosaic.json` against §4 (block algorithm) and §5 (schema)
- Resolve references per §7
- Handle assets per §8

MAY produce HTML, JSON, native UI, print, anything.

### Level 2 — Reader+Writer

Level 1 + MUST be able to produce Mosaic output: write `mosaic.json` and content files such that another Level 1 implementation reads them without error.

### Level 3 — Live editor

Level 2 + MUST preserve concurrent edits without data loss. Typically a CRDT-backed engine (Clear is Level 3; static-site generators are Level 1).

---

## 2. Filesystem and encoding

- Files MUST be UTF-8 encoded. JSON files SHOULD have trailing newline.
- Directory and file names MUST match `[a-z0-9_-]+` for identifiers; `/` is the directory separator.
- File extensions: `.json`, `.md` for content; binary assets use their native extension; engine snapshots use `.loro` (implementation-specific).
- Slugs MUST start with `/` and contain only `[a-z0-9_-/]`.
- A page at slug `/about/team` MAY live at `content/pages/about/team.json` OR `content/pages/about/team/index.json` — both forms are valid.

---

## 3. File tree

A Mosaic site is a directory containing the following structure. Items marked OPTIONAL may be omitted.

```
my-site/
├─ mosaic.json                       # REQUIRED — site schema. (Implementations MAY accept the name `clear.json` as a synonym.)
├─ content/
│  ├─ pages/                         # REQUIRED — at least one page record
│  │  └─ <slug>.json
│  ├─ <collection>/                  # OPTIONAL — records-on-path layout
│  │  └─ <record-id>.json
│  ├─ collections/                   # OPTIONAL — single-file collection layout
│  │  └─ <collection>.json
│  └─ blog/                          # OPTIONAL — pattern for records with bodies
│     ├─ <slug>.json
│     └─ <slug>.md
├─ assets/                           # OPTIONAL
│  ├─ manifest.json                  # REQUIRED if assets/ exists
│  └─ <human-paths-to-binaries>
├─ blocks/                           # OPTIONAL — engine-internal block bodies
│  └─ sha256/<hash>/content.json
├─ globals/                          # OPTIONAL — site-wide singletons (§9)
│  └─ <name>.json
└─ snapshots/                        # OPTIONAL — Level 3 engine artifacts
   └─ <timestamp>.<engine-extension>
```

Implementations MUST NOT fail if OPTIONAL directories are absent. Implementations MAY emit warnings.

---

## 4. `mosaic.json` (the site schema)

```json
{
  "meta":          { "name": "...", "schemaVersion": 1, "domain": "..."? },
  "tokens":        { "<group>": { "<name>": "<value>", ... }, ... },
  "blockTypes":    { "<typeName>": <BlockType>, ... },
  "collections":   { "<name>": <Collection>, ... },
  "structs":       { "<name>": <Struct>, ... }?,
  "i18n":          <I18n>?,
  "layouts":       { "<name>": <LayoutSpec>, ... }?
}
```

### 4.1 `meta`

REQUIRED. Keys:
- `name` (string, REQUIRED) — human-readable site name
- `schemaVersion` (integer, REQUIRED) — bumps on breaking change to this site's schema
- `domain` (string, OPTIONAL) — canonical public URL host

### 4.2 `tokens`

OPTIONAL. Two-level map of design token group → name → value. Renderers SHOULD expose tokens as accessible variables (CSS custom properties, theme objects, etc.). Token values are opaque strings; semantics are up to the renderer.

Common groups (by convention, not enforced): `color`, `font`, `size`, `space`, `radius`, `shadow`, `leading`, `tracking`, `weight`, `duration`, `ease`.

### 4.2a `tokenOverrides` cascade (v0.2 DRAFT)

Tokens declared in `mosaic.json#tokens` are the site-level defaults. v0.2 introduces an additive **scope cascade** that allows pages and section instances to rebind token VALUES for a narrower scope:

```
site (mosaic.json#tokens)
  └─ page (page.tokenOverrides)
       └─ section (sectionInstance.tokenOverrides)
            └─ slot (rare — see "Open question" in v0.2-changes.md)
```

Resolution rules:
- `tokenOverrides` is a two-level map of `<group>` → `<name>` → `<value>`, same shape as `tokens` (§4.2).
- Resolution is **last-write-wins** along the cascade: section overrides page, page overrides site.
- `tokenOverrides` MUST only override token names already declared at the site level. Introducing a NEW `<group>` or `<name>` via an override is INVALID; readers MUST ignore unknown overrides and SHOULD emit a warning.
- Renderers SHOULD expose overrides as scoped CSS custom property declarations on the page wrapper (for page-level overrides) and the section wrapper (for section-level overrides), so that nested elements inherit naturally. For non-CSS renderers, scoping is implementation-defined but MUST preserve the same last-write-wins precedence.
- Token VALUE changes via `tokenOverrides` are non-breaking and MUST NOT bump `schemaVersion` (§10 Versioning).

Where `tokenOverrides` may appear:
- On a page record — see §5.2.
- On a `SectionInstance` — see §5.1, additive field.

Level 1 readers MAY ignore `tokenOverrides` entirely; sections render with site-level tokens. Support is OPTIONAL.

### 4.3 `blockTypes`

REQUIRED (MAY be empty). A `BlockType` MUST have:
- `variants`: `string[]` — closed set of variant identifiers (MAY be empty)
- `slots`: `{ <slotName>: <SlotDef>, ... }` — slot definitions

A `BlockType` MAY have:
- `layout`: `{ direction?, gap?, align? }` — layout primitives (§4.6)
- `description`: string

### 4.4 `SlotDef`

A `SlotDef` MUST have `type` from the closed set:
`text` · `richtext` · `asset` · `ref` · `list` · `struct` · `code` · `number` · `boolean`

Each `SlotDef` MAY have:
- `required`: `boolean` (default `false`)
- `description`: `string`
- type-specific fields per §4.5

### 4.5 Slot type-specific fields

| Type | Required additional | Optional additional |
|------|---------------------|---------------------|
| `text` | — | `maxLength: number`, `pattern: string` (RegExp) |
| `richtext` | — | `format: "markdown" \| "portable-text"` (default `"markdown"`), `translatable: boolean` |
| `asset` | — | `accept: string[]` from `["image", "video", "audio", "font", "svg", "pdf", "any"]` |
| `ref` | `refTo: string` (collection name) | — |
| `list` | `of: string` (`"string"`, `"number"`, `"ref:<col>"`, `"struct:<name>"`) | `min: number`, `max: number` |
| `struct` | `name: string` (struct name from `structs`) | — |
| `code` | — | `lang: string[]` (whitelist) |
| `number` | — | `min: number`, `max: number`, `integer: boolean` |
| `boolean` | — | — |

### 4.6 Layout primitives

OPTIONAL on every `BlockType`. Renderers SHOULD interpret:
- `direction`: `"row"` \| `"column"`
- `gap`: `"stack"` \| `"block"` \| `"section"` (corresponds to spacing tokens by convention)
- `align`: `"start"` \| `"center"` \| `"end"` \| `"stretch"`

Unknown values MUST be ignored, not error.

### 4.6a `LayoutSpec` (v0.2 DRAFT)

The `layouts` map (§4) declares named layout templates that pages reference via `page.layout: "<name>"` (§5). A `LayoutSpec` describes a responsive grid that section instances opt into via §5.1a. Support is OPTIONAL for Level 1 readers; readers MAY ignore `layouts` and stack sections vertically.

```jsonc
"layouts": {
  "longform": {
    "grid": { "columns": 12, "gap": "section" },
    "breakpoints": { "sm": 640, "md": 900, "lg": 1280 },
    "areas": {
      "default": [["header"], ["content"], ["footer"]],
      "lg":      [["header header header"],
                  [".      content ."     ],
                  ["footer footer footer"]]
    },
    "sectionDefaults": { "area": "content" }
  }
}
```

A `LayoutSpec` MUST have:
- `grid`: object with:
  - `columns`: integer (1–24) — column count for the largest declared breakpoint
  - `gap`: `"stack"` \| `"block"` \| `"section"` — gap token (per §4.6 convention)
- `areas`: object mapping a breakpoint key (or `"default"`) to a 2-D array of area-name rows. Each row is an array of strings; each string is one cell's area name, or `"."` for an empty cell. Repeated names on adjacent cells span those cells (CSS Grid `grid-template-areas` semantics). Row counts MAY differ across breakpoints.

A `LayoutSpec` MAY have:
- `breakpoints`: object mapping a breakpoint key to a min-viewport-width integer (pixels). Keys MUST be `[a-z0-9]+`. Renderers SHOULD apply each breakpoint's `areas` entry above its min width; otherwise the `"default"` entry applies.
- `sectionDefaults`: object with `area: "<areaName>"` — area assigned to a section that does not declare `sectionLayout` (§5.1a).
- `description`: string

Constraints:
- Every area name used in `areas` MUST be referenceable from §5.1a `sectionLayout.area`.
- `areas.default` is REQUIRED if `breakpoints` is omitted; OPTIONAL otherwise (the smallest breakpoint's entry acts as default).
- Renderers SHOULD implement `LayoutSpec` via CSS Grid. Implementations targeting non-CSS surfaces (mobile native, print) MAY approximate areas as a vertical stack ordered by row, then column.

Unknown fields in a `LayoutSpec` MUST be preserved by Level 2+ writers.

### 4.7 `collections`

REQUIRED (MAY be empty). A `Collection` MUST have:
- `schema`: `string` — struct name from `structs` (or a built-in like `"blogPost"`)

A `Collection` MAY have:
- `indexBy`: `string` — record field to sort by (e.g. `"publishedAt"`)
- `urlPattern`: `string` — pattern for record URLs (e.g. `"/blog/{slug}"`); omitted means records are embedded-only
- `layout`: `"single-file"` \| `"records-on-path"` — preferred file layout. Implementations MUST accept both regardless of declared preference.

### 4.8 `structs` (OPTIONAL)

Reusable shape definitions referenced from `slots[].of` (lists), `slots[].name` (struct slots), and `collections[].schema`. Same shape as `BlockType.slots`.

### 4.9 `i18n` (OPTIONAL)

```json
{
  "defaultLocale": "en",                  // REQUIRED
  "locales": ["en", "fr", "es"],          // REQUIRED, includes defaultLocale
  "routing": "prefix" | "subdomain" | "domain",   // REQUIRED
  "fallback": "default" | "404"           // REQUIRED
}
```

---

## 5. Page records

A page record at `content/pages/<slug>.json`:

```json
{
  "title": "string",                      // REQUIRED
  "slug": "string",                       // REQUIRED, MUST match its filesystem position
  "status": "draft" | "published",        // REQUIRED
  "sections": [<SectionInstance>, ...],   // REQUIRED (MAY be empty)

  "publishedVersion": "ISO timestamp",    // OPTIONAL — when this page was last published
  "publishedAt": "YYYY-MM-DD",            // OPTIONAL — original publish date (editorial)
  "author": { "name": "...", "handle": "..." },   // OPTIONAL
  "seo": { "title": "...", "description": "...", "ogImage": "asset:..." },  // OPTIONAL
  "layout": "string"                      // OPTIONAL — renderer-specific
}
```

Unknown fields MUST be preserved by Level 2+ writers (forward compat).

### 5.1 `SectionInstance`

```json
{
  "id": "string",                         // REQUIRED, unique within page
  "blockType": "string",                  // REQUIRED, MUST be declared in mosaic.json
  "variant": "string",                    // OPTIONAL; if present, MUST be in blockType.variants
  "state": "draft" | "published",         // OPTIONAL, default "published"
  "publishedHash": "string" | null,       // OPTIONAL, sha256 of last published slot content
  "slots": { "<slotName>": <value>, ... }, // REQUIRED
  "sectionLayout": <SectionLayout>,       // OPTIONAL (v0.2 DRAFT, see §5.1a)
  "tokenOverrides": { "<group>": { "<name>": "<value>" } }   // OPTIONAL (v0.2 DRAFT, see §4.2a)
}
```

The `id` MUST be stable across edits. Renderers SHOULD use it as an HTML id or anchor.

### 5.1a `sectionLayout` on a SectionInstance (v0.2 DRAFT)

A `SectionInstance` MAY include an OPTIONAL `sectionLayout` field that opts the section into a named area of the page's `LayoutSpec` (§4.6a):

```json
{
  "id": "intro",
  "blockType": "richtextBlock",
  "slots": { "...": "..." },
  "sectionLayout": {
    "area": "content",
    "span": 8
  }
}
```

- `area`: REQUIRED if `sectionLayout` is present — MUST be an area name declared in the page's resolved `LayoutSpec.areas`.
- `span`: OPTIONAL integer — column span within the area (1–`grid.columns`). Renderers MAY ignore.
- If `sectionLayout` is absent, the section falls into `LayoutSpec.sectionDefaults.area` (if declared) or the default flow (vertical stack).
- If `area` references an unknown area name, renderers MUST fall back to `sectionDefaults.area`, then to default flow. Renderers SHOULD emit a warning.

`sectionLayout` is additive to §5.1: readers that ignore it MUST still render the section in default flow.

### 5.2 `tokenOverrides` on page records (v0.2 DRAFT)

A page record MAY include an OPTIONAL `tokenOverrides` field that re-binds token values for the scope of that page only. See §4.2a for full cascade semantics.

```json
{
  "title": "Limited edition",
  "slug": "/le",
  "status": "published",
  "sections": [],
  "tokenOverrides": {
    "color": { "accent": "#ff2d55" },
    "font":  { "display": "var(--font-serif-display)" }
  }
}
```

---

## 6. Validation

A Level 1 reader MUST validate every section it processes. Section is **invalid** if:

- `blockType` is not declared in `mosaic.json#blockTypes`
- `variant` is set and not in the block type's `variants`
- A `required: true` slot is absent, null, or empty string
- A slot value doesn't satisfy its type rules (§4.5)
- A `ref:` value points at a non-existent record
- A `list` slot's length is outside `[min, max]`

Invalid sections MUST NOT crash a reader. Readers MUST surface them via:
- A warnings channel (CLI, log, API field)
- Optional refusal to render (configurable strictness)

### 6.1 Consumer capability declaration — silent skip (v0.2 DRAFT)

§6 defines what happens to an *invalid* section (warnings channel) and §6's preceding context implies that an unknown `blockType` renders as a `<missing template>` placeholder — appropriate for an engine-default renderer with no other contract.

Headless consumers — custom renderers, mobile apps, AI summarisers, search indexers, RSS feed builders — are partial views of a Mosaic document and typically implement only a subset of canonical block types. For these consumers, a placeholder is the wrong default.

A consumer MAY declare a **supported block types set** as part of its rendering contract. Such a consumer:

- MUST silently drop sections whose `blockType` is not in its supported set from the render output.
- MUST NOT emit a `<missing template>` placeholder for dropped sections.
- MUST NOT raise a validation warning for the unsupported `blockType` itself (separate from §6 validation: a section can be both valid per the site schema and unsupported by the consumer).
- SHOULD still apply §6 validation for *supported* sections.
- SHOULD preserve unsupported sections in any pass-through serialisation (e.g. a Level 2 writer round-tripping the document) so that other consumers still see them. Silent skip applies to rendering, not to storage.

The canonical implementation pattern is a `SKIP_BLOCKS` set (or equivalent allow-list / deny-list) consulted before rendering each section. The set is consumer-side configuration; `mosaic.json` itself MUST NOT declare per-consumer skip rules.

Rationale: a headless consumer is a partial projection of the document. Forcing it to emit placeholders for blocks outside its scope leaks engine-default rendering concerns into surfaces where they don't belong (an RSS feed has no concept of a "missing template").

This contract is OPTIONAL for engine-default renderers, which SHOULD continue to surface unknown blocks per §6.

---

## 7. Reference resolution

Four reference shapes appear inside slot values (§7.1–§7.4). Resolution is recursive: values inside arrays and objects MUST be walked.

### 7.1 `asset:<path>`

`asset:images/hero.jpg` resolves to:

```json
{
  "kind": "asset",
  "path": "images/hero.jpg",
  "sha256": "<from manifest>" | null,
  "url": "<implementation-specific>" | null
}
```

Resolution algorithm:
1. Strip the `asset:` prefix → `<path>`
2. Look up `<path>` in `assets/manifest.json#paths`. If found, set `sha256`.
3. Implementation determines `url` (local file path, CDN URL, signed S3, etc.)
4. If the file is text (`.md`, `.json`, `.txt`, `.svg`) and present, readers MAY inline the body as `{ kind: "asset", ..., body: "<text>", inlined: true }`.

Server-only fields (e.g. local filesystem absolute path) MUST NOT cross the network boundary.

### 7.2 `ref:<collection>/<id>`

`ref:blog/a-site-is-a-document` resolves to:

```json
{
  "kind": "record",
  "collection": "blog",
  "id": "a-site-is-a-document",
  "data": { ... }
}
```

Algorithm:
1. Split on `/` → `<collection>`, `<id>`
2. Locate the collection in either layout: `content/<collection>/<id>.json` (records-on-path) OR `content/collections/<collection>.json#entries[<id>]` (single-file)
3. Validate the record's shape matches `collections[<collection>].schema`

If unresolvable, the resolver MUST return:
```json
{ "kind": "ref-missing", "ref": "ref:blog/a-site-is-a-document" }
```

### 7.3 `block:sha256-<hash>`

Engine-internal block bodies (Tier 2 storage). Resolves to:

```json
{
  "kind": "block",
  "sha256": "abc123...",
  "content": { ... } | null
}
```

Implementations without hybrid storage MAY ignore (treat as content placeholder).

### 7.4 `asset:content/<path>.md`

Special form of §7.1 where the asset is a Markdown body. Renderers SHOULD parse the body as CommonMark + GFM.

### 7.5 Circular references

If A.slot refs B, and B.slot refs A: the resolver MUST detect the cycle and return one ref as `kind: "record"` with full data, the other as `kind: "ref-cycle"` with just `{ kind, ref }`. MUST NOT infinite-loop.

---

## 8. Asset manifest

`assets/manifest.json`:

```json
{
  "version": 1,
  "updated": "ISO timestamp",
  "paths": { "<relative path under assets/>": "sha256-<hash>" }
}
```

Sha256 is informational: it lets refs survive renames (path moves in manifest, refs stay valid). Implementations MUST trust the path as primary; sha256 enables dedup and verification.

If a `asset:` ref's path is not in the manifest, resolvers SHOULD still attempt to resolve it relative to the assets directory.

---

## 9. Globals (OPTIONAL)

Globals are named, schema-declared site-wide singletons that the renderer injects at canonical positions across every page. They are NOT hard-coded to specific names — sites declare any number of globals via `mosaic.json#globals`.

### 9.1 Declaration

```json
"globals": {
  "<id>": {
    "blockType": "<blockTypeName>",       // REQUIRED, references a declared blockType
    "position": "<position-spec>",        // REQUIRED, where to inject
    "instance": "<path-to-record>",       // REQUIRED, the actual content (e.g., "globals/site-header.json")
    "repeat": <repeat-spec>,              // OPTIONAL, default false
    "above": "<other-global-id>",         // OPTIONAL, relative ordering hint
    "below": "<other-global-id>"          // OPTIONAL, relative ordering hint
  }
}
```

### 9.2 Position vocabulary

A `position` is one of:

| Value | Meaning |
|-------|---------|
| `"page-top"` | Above all sections on every page (outside content column) |
| `"page-bottom"` | Below all sections on every page |
| `"page-side-left"` | Sidebar to the left of content (desktop); stacked at top (mobile) |
| `"page-side-right"` | Sidebar to the right of content (desktop); stacked at top (mobile) |
| `"before:<global-id>"` | Immediately before another global |
| `"after:<global-id>"` | Immediately after another global |
| `"before-section:<n>"` | Before section at index `n` |
| `"after-section:<n>"` | After section at index `n` |

Unknown positions MUST fall back to `"page-bottom"` and emit a warning.

### 9.3 Repeat vocabulary

| Value | Meaning |
|-------|---------|
| `false` (default) | Render once at the declared position |
| `true` | Render at every defined position match (rarely useful) |
| `"every N sections"` | Interleave a copy after every N sections |
| `"every N pixels"` | (Renderer-specific) inject at scroll intervals — useful for sticky-side widgets on long pages |

### 9.4 Per-page override

A page record MAY include `globalsOverride: { ... }` to alter global rendering on that page only:

```json
{
  "title": "...",
  "globalsOverride": {
    "<global-id>": "off",                          // disable for this page
    "<global-id>": "override",                     // page provides its own section of same blockType; renderer must NOT also inject the global
    "<global-id>": { "instance": "<other-path>" }  // swap to a different instance for this page
  }
}
```

`globalsOverride` is OPTIONAL and OPTIONAL to implement; a renderer that ignores it still complies.

### 9.5 Instance content shape

Each global's `instance` file holds a record matching the block type's slot shape (same as a section's `slots`). It is NOT wrapped in a section instance (no `id`, no `state`, no `publishedHash`) — just the slot values:

```json
// globals/site-header.json
{
  "logo": "Clear",
  "nav": [
    { "label": "Product", "href": "/product" },
    { "label": "Docs",    "href": "/docs" }
  ],
  "ctaLabel": "Get started",
  "ctaHref":  "/get-started"
}
```

### 9.6 Conformance

Globals support is OPTIONAL for Level 1 readers. A renderer that doesn't implement globals injection is still spec-compliant — consumer pages have to inline the singletons in `sections[]` instead.

---

## 10. Overlays (OPTIONAL)

Overlays are off-flow page elements: lightboxes, popups, modals, drawers, toasts. They differ from sections (which live in the document flow) and globals (which inject at canonical document positions) — overlays render outside the document flow, often above it, and are typically triggered rather than always-visible.

### 10.1 Declaration

```json
"overlays": {
  "<id>": {
    "blockType": "<overlayBlockType>",    // REQUIRED, e.g. lightbox, modal, drawer, newsletterPopup, cookieConsent, toast
    "instance": "<path-to-record>",       // OPTIONAL, depends on block type (lightbox often has no instance)
    "trigger": "<trigger-spec>",          // REQUIRED, when to surface
    "persist": "<persist-spec>"           // OPTIONAL, how to remember dismissals
  }
}
```

### 10.2 Trigger vocabulary

| Value | Meaning |
|-------|---------|
| `"manual"` | Only opens when an in-content link points at `#overlay:<id>` |
| `"auto-image-links"` | Lightbox-specific — wraps every image/asset ref in a click-to-open handler |
| `"scroll:N%"` / `"scroll:Npx"` | Triggers when page scrolled by N percent / N pixels |
| `"delay:Nms"` | After N milliseconds on the page |
| `"exit-intent"` | Mouse moves toward browser chrome / tab close |
| `"first-visit"` | Only on the first page view per `persist` window |
| `"every-visit"` | Every page view (use carefully) |

### 10.3 Persist vocabulary

How a dismissal is remembered:

| Value | Meaning |
|-------|---------|
| `"session"` | Until page reload / tab close |
| `"forever"` | Indefinitely (localStorage) |
| `"dismissed-for-7d"` / `"dismissed-for-12h"` / etc. | Time-window dismissal |

If `persist` is absent, default is `"session"` for ephemeral overlays (toast, exit-intent) and `"forever"` for declarative consents (cookieConsent).

### 10.4 Canonical overlay block types

Implementations MAY recognize and template these by name:

- **`lightbox`** — image gallery overlay. Trigger usually `"auto-image-links"`. No `instance` required.
- **`modal`** — generic centered modal with content slot.
- **`drawer`** — slide-in side panel (variants: `"left"`, `"right"`).
- **`newsletterPopup`** — email + name capture, dismissible.
- **`cookieConsent`** — accept/reject + persist choice.
- **`exitOffer`** — special-purpose modal triggered by `"exit-intent"`.
- **`toast`** — small ephemeral notification.

Unknown overlay block types render via the standard fallback ("missing template" — see §6).

### 10.5 Manual trigger linking

In-content links of the form `<a href="#overlay:<id>">` SHOULD open the named overlay when clicked, in implementations that support overlays. Renderers MAY implement this via JS / Web Components / `<dialog>` element / framework-specific portal — Mosaic doesn't specify the mechanism, only the URL contract.

### 10.6 Conformance

Overlays support is OPTIONAL for Level 1 readers. A pure-static or headless consumer MAY ignore the `overlays` declaration entirely.

---

## 10. Versioning

Mosaic version (this spec) is independent of `mosaic.json#meta.schemaVersion` (a particular site's schema version).

- Spec version `0.x` — breaking changes possible
- Spec version `1.0` and later — semver semantics

A site's `schemaVersion` MUST bump on:
- Adding or removing a `blockType`
- Changing a `SlotDef` type or `required` flag
- Renaming variants
- Token group additions/removals (token VALUE changes are non-breaking)

Block-type evolutions are implementation-defined; Mosaic does not standardize them.

---

## 10a. Layout pattern — outer / inner

Renderers SHOULD follow the **outer / inner** pattern for block markup so that backgrounds can stretch edge-to-edge while content stays within a consistent content cage:

```html
<section class="block <blockType> <blockType>--<variant>">
  <div class="block__inner">
    ...block content...
  </div>
</section>
```

- The **outer** `.block` element fills 100% of the viewport width. Backgrounds (colors, images, gradients) applied to `.block` paint wall-to-wall, regardless of viewport.
- The **inner** `.block__inner` element constrains content. Recommended: `max-width: 1200px; margin: 0 auto; padding: 0 clamp(1rem, 4vw, 2rem);`

Blocks that intentionally render full-bleed content (e.g. `mediaBlock--full-bleed` for hero imagery, `hero--fullbleed` for cinematic heroes) MAY omit the `.block__inner` wrapper so the content stretches to the viewport edges along with the background.

This pattern is OPTIONAL — renderers MAY use a single-container layout instead. Mosaic does not specify markup; this guidance lives in the spec because the pattern is well-tested and removes the most common "everything looks the same" complaint when blocks share a width-constrained container.

---

## 10b. `freeform` canonical block type (v0.2 DRAFT)

`freeform` is a canonical block type in the standard library that allows absolute positioning of items inside a declared aspect-ratio canvas. It is the spec's documented escape hatch for design-heavy content that does not decompose cleanly into stacked sections — covers, editorial inserts, posters, hero illustrations, art-directed callouts.

`freeform` is OPTIONAL: it is the least portable canonical block across renderers (depends on absolute positioning + a fixed aspect canvas) and Level 1 readers MAY treat it as an unknown block (§6) or silently skip it (§6.1).

### 10b.1 Declaration

```jsonc
"blockTypes": {
  "freeform": {
    "variants": ["default"],
    "slots": {
      "aspect": { "type": "text", "required": true },   // e.g. "16/9", "3/4", "1/1"
      "items":  { "type": "list", "of": "struct:freeformItem", "required": true }
    }
  }
},
"structs": {
  "freeformItem": {
    "kind":     { "type": "text", "required": true },   // "text" | "asset" | "shape"
    "position": { "type": "struct", "name": "freeformPosition", "required": true },
    "slots":    { "type": "struct", "name": "freeformItemSlots" }
  },
  "freeformPosition": {
    "x":         { "type": "number", "required": true },   // % of container width OR px (see §10b.3)
    "y":         { "type": "number", "required": true },   // % of container height OR px
    "w":         { "type": "number", "required": true },   // % or px
    "h":         { "type": "number", "required": true },   // % or px
    "z":         { "type": "number" },                     // OPTIONAL, integer; higher = on top
    "rotation":  { "type": "number" },                     // OPTIONAL, degrees
    "units":     { "type": "text" }                        // OPTIONAL, "percent" (default) | "px"
  },
  "freeformItemSlots": {
    "text":   { "type": "richtext" },                      // if kind == "text"
    "asset":  { "type": "asset" },                         // if kind == "asset"
    "shape":  { "type": "text" },                          // if kind == "shape", names a primitive (e.g. "rect", "circle")
    "fill":   { "type": "text" },                          // OPTIONAL, color token or value
    "stroke": { "type": "text" }                           // OPTIONAL
  }
}
```

### 10b.2 Slots

- `aspect`: REQUIRED string of the form `"<W>/<H>"` (e.g. `"16/9"`). The canvas scales responsively while preserving this ratio.
- `items`: REQUIRED list of `freeformItem` structs. MAY be empty.

### 10b.3 Item kinds

- `"text"` — `slots.text` (richtext) is rendered inside the positioned box.
- `"asset"` — `slots.asset` (asset ref, §7.1) is rendered inside the box. Typically an image or SVG.
- `"shape"` — `slots.shape` names a primitive shape. Renderers SHOULD implement at least `"rect"` and `"circle"`. Unknown shapes MUST be ignored (no fallback rendering).

### 10b.4 Coordinate system

`units` selects the coordinate basis for `x`, `y`, `w`, `h`:
- `"percent"` (default) — values are 0–100, relative to the canvas's resolved width/height. Renderers SHOULD use `position: absolute` with `left/top/width/height` as percentages.
- `"px"` — values are absolute pixels measured against the canvas at its declared aspect. Renderers SHOULD scale via CSS transform or clamp.

`z` is an integer; higher values render on top. Items with no `z` render in document order, all below items that declare `z`.

`rotation` is in degrees clockwise. Renderers SHOULD apply via CSS `transform: rotate(...)` after positioning.

### 10b.5 Rendering

Renderers SHOULD render a `freeform` section as:

```html
<section class="block freeform">
  <div class="freeform__canvas" style="aspect-ratio: 16/9; position: relative;">
    <div class="freeform__item" style="position: absolute; left: 10%; top: 20%; width: 30%; height: 40%; z-index: 5; transform: rotate(-3deg);">
      ...item content...
    </div>
    ...
  </div>
</section>
```

The canvas MUST establish its own positioning context (`position: relative`) so children can be positioned absolutely against it. Renderers MAY omit `.freeform__canvas` if the outer section element already provides the positioning context.

### 10b.6 Tradeoffs and portability

`freeform` is the LEAST portable canonical block:
- Absolute positioning does not gracefully degrade to other surfaces (RSS, plaintext email, screen readers benefit from explicit alt text).
- Non-CSS renderers (native mobile, print) MUST approximate as a vertical stack ordered by `z` ascending — accepting that the visual composition will not survive.
- Headless consumers (§6.1) SHOULD include `freeform` in their skip set unless they specifically support it.

Authors SHOULD prefer composing standard blocks where possible. `freeform` is the intentional escape hatch for cases where the design IS the message.

---

## 11. The reference implementation

[Clear](https://github.com/clearcms/clear) is a Level 3 implementation:
- Parser + validator: `@clear/core` (parser) + `@clear/schema` (validator)
- Reference resolver: `@clear/render`
- Render adapter (engine default): `@clear/render-astro` + an HTML adapter in `@clear/render`
- CRDT engine: `@clear/core/loro.mjs` (LoroDoc-backed `Doc` + `DocEngine`)
- Headless API: dev server's `/api/v1/...`
- CLI: `clear init / dev / push / pull / render / validate / info / roundtrip / import-astro`

Other implementations are encouraged. Open an issue to be listed.

---

## 12. Open questions for v0.2+

- **Translation key serialization** — locale-keyed values are clear in principle but JSON path conventions for "this whole slot is translatable" vs "this string field on this struct is translatable" need formalizing.
- **Block algorithm migration** — schema bump tooling, op-level "this is a schema change" detection.
- **Asset access controls** — currently all assets are public-readable; per-asset auth is undefined.
- **Plugin / extension blocks** — third-party block types: sandboxing, identifier namespacing.
- **JSON Schema for `mosaic.json` itself** — formal validator-via-JSON-Schema is planned for v0.2.
- **Portable Text adoption** — when richtext format = `"portable-text"`, full Portable Text spec applies; need to clarify what's required vs optional.

---

## Appendix A — example sites

The [Clear engine repo](https://github.com/clearcms/clear) includes:
- `examples/minimal-site/` — smallest valid Mosaic site (one block type, one page, one section)
- `examples/blog-site/` — a small site with a blog collection demonstrating `ref:` + body markdown

The [Clear marketing site repo](https://github.com/clearcms/marketing-site) is itself a Mosaic site under Apache 2.0 — the largest real-world example.

---

## Appendix B — change log

- **v0.1 (2026-05-10)** — first published spec. Format reference, conformance levels, resolution algorithm, manifest semantics, globals pattern, versioning rules.
