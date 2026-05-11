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
  "slots": { "<slotName>": <value>, ... } // REQUIRED
}
```

The `id` MUST be stable across edits. Renderers SHOULD use it as an HTML id or anchor.

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
