# Mosaic — normative specification

**Version:** 0.3 (draft — normative; subject to change pre-v1.0)
**License:** CC0 1.0 Universal
**Reference implementation:** [Clear](https://github.com/clearcms/clear)

This document is the normative spec for Mosaic. The [README](./README.md) is the introduction. This file is the validator's-eye view: closed taxonomies, conformance levels, resolution algorithms, edge cases.

Keywords: **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY** follow [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

A **decision log** of every design call made in v0.3 is in **Appendix F**. Read that first if you want to know what changed from v0.1 / v0.2-draft and why.

---

## 0. Terminology

These terms appear throughout the spec with the meanings defined here.

- **Mosaic document** — a directory tree conforming to §3. Sometimes called a "site."
- **Page** — a record under `content/pages/` that defines a URL-addressable page (§5).
- **Record** — any JSON file under `content/` that follows a declared shape. Pages are records; collection entries are records.
- **Section** — one block instance placed on a page (§5.1).
- **Slot** — a typed field on a block type; the unit of content storage (§4.4).
- **Block type** — a reusable section shape declared in `mosaic.json#blockTypes` (§4.3).
- **Token** — a design value (color, font, size, etc.) declared in `mosaic.json#tokens` (§4.2).
- **Reference** — a typed string value (`asset:...`, `ref:...`, `block:sha256-...`) that resolves to other content. Grammar in Appendix C; resolution in §7.
- **Engine** — an implementation that reads and possibly writes Mosaic documents. Engines claim a conformance level (§1).
- **Renderer** — an engine, or a subsystem of an engine, that produces output (HTML, JSON, native UI, RSS, etc.) from a Mosaic document.
- **Consumer** — any reader of a Mosaic document, including renderers. Subject to validation (§6) and silent-skip (§6.1) rules.
- **Conformant** — an implementation that satisfies all MUST/MUST NOT requirements at its declared conformance level.
- **`mosaicVersion`** — the spec version a Mosaic document targets, declared in `mosaic.json#meta.mosaicVersion`. Used for migration (§11.2).

---

## 1. Conformance levels

Implementations claim a **conformance level**. A Mosaic-conformant implementation MUST clearly document its level.

### 1.1 Level 1 — Reader

An implementation that consumes Mosaic and renders or processes the content. MUST:
- Parse the file tree per §3
- Validate `mosaic.json` against §4 and validate each content record against §5
- Resolve references per §7 (per the grammar in Appendix C)
- Handle assets per §8
- Apply forward-compatibility rules per §11.2 when `mosaicVersion` exceeds the implementation's supported version

MAY produce HTML, JSON, native UI, print, anything.

### 1.2 Level 2 — Reader + Writer

Level 1 + MUST be able to produce Mosaic output: write `mosaic.json` and content files such that another Level 1 implementation reads them without raising any error AND produces no validation warnings for content that originated as valid Mosaic. Level 2 writers MUST preserve unknown fields anywhere in a Mosaic document (§11.2).

### 1.3 Level 3 — Live editor

Level 2 + MUST preserve concurrent edits per §13. Typically a CRDT-backed engine. Clear is Level 3; static-site generators are Level 1.

---

## 2. Filesystem and encoding

- Files MUST be UTF-8 encoded. JSON files SHOULD have a trailing newline.
- Directory and file names MUST match `[a-z0-9_-]+` for identifiers. `/` is the directory separator. On Windows filesystems, implementations MUST translate `\` to `/` when serialising paths in JSON.
- File extensions: `.json`, `.md` for content; binary assets use their native extension; CRDT engine snapshots use `.loro` (legacy `.clear` MAY be read but MUST NOT be written by Level 2+).
- **Page slugs** (`page.slug`, §5) MUST start with `/` and contain only `[a-z0-9_-/]`. They represent the URL path directly.
- **Collection record ids/slugs** (the `<id>` portion of `ref:<collection>/<id>` and the `slug` field on collection records) are bare and MUST match `[a-z0-9_-]+`. The collection's `urlPattern` (§4.7) provides any URL prefix.
- A page at slug `/about/team` MAY live at `content/pages/about/team.json` OR `content/pages/about/team/index.json` — both forms are valid.

---

## 3. File tree

A Mosaic document is a directory containing the following structure. Items marked OPTIONAL may be omitted.

```
my-site/
├─ mosaic.json                       # REQUIRED — site schema (§4)
├─ mosaic.schema.json                # OPTIONAL — JSON Schema 2020-12 validator (Appendix D)
├─ content/
│  ├─ pages/                         # OPTIONAL (see §3.1) — page records
│  │  └─ <slug>.json
│  ├─ <collection>/                  # OPTIONAL — records-on-path layout
│  │  └─ <record-id>.json
│  ├─ collections/                   # OPTIONAL — single-file collection layout
│  │  └─ <collection>.json
│  └─ blog/                          # OPTIONAL — pattern for records with bodies
│     ├─ <slug>.json
│     └─ <slug>.md
├─ assets/                           # OPTIONAL
│  ├─ manifest.json                  # REQUIRED if and only if assets/ exists (§8)
│  └─ <human-paths-to-binaries>
├─ blocks/                           # OPTIONAL — engine-internal block bodies (§14)
│  └─ sha256/<hash>/content.json
├─ globals/                          # OPTIONAL — site-wide singletons (§9)
│  └─ <name>.json
└─ snapshots/                        # OPTIONAL — Level 3 engine artifacts
   └─ <timestamp>.loro
```

Implementations MUST NOT fail if OPTIONAL directories are absent. Implementations MAY emit warnings.

### 3.1 The zero-content valid document

A Mosaic document with `mosaic.json` containing valid `meta` + empty `blockTypes: {}` + empty `collections: {}`, and no `content/`, `assets/`, `globals/`, `blocks/`, or `snapshots/` directories, IS conformant. Pages are not REQUIRED. This is the minimal valid Mosaic document. (Resolves v0.2 issue C6.)

---

## 4. `mosaic.json` (the site schema)

```json
{
  "meta":          { "name": "...", "mosaicVersion": "0.3", "schemaVersion": 1, "domain": "..."? },
  "tokens":        { "<group>": { "<name>": "<value>", ... }, ... }?,
  "blockTypes":    { "<typeName>": <BlockType>, ... },
  "collections":   { "<name>": <Collection>, ... },
  "structs":       { "<name>": <Struct>, ... }?,
  "i18n":          <I18n>?,
  "layouts":       { "<name>": <LayoutSpec>, ... }?,
  "globals":       { "<id>": <Global>, ... }?,
  "overlays":      { "<id>": <Overlay>, ... }?
}
```

### 4.1 `meta`

REQUIRED. Keys:
- `name` (string, REQUIRED) — human-readable site name
- `mosaicVersion` (string, REQUIRED) — spec version this document targets (e.g. `"0.3"`). See §11.2.
- `schemaVersion` (integer, REQUIRED) — bumps on breaking change to **this site's** block-type or collection schemas (independent of `mosaicVersion`).
- `domain` (string, OPTIONAL) — canonical public URL host

### 4.2 `tokens`

OPTIONAL. Two-level map of design token group → name → value. Renderers SHOULD expose tokens as accessible variables (CSS custom properties, theme objects, etc.). Token values are opaque strings; semantics are up to the renderer. Common token groups are recommended in Appendix E.

### 4.2a `tokenOverrides` cascade

Tokens declared in `mosaic.json#tokens` are the site-level defaults. Pages and section instances MAY rebind token values for a narrower scope:

```
site (mosaic.json#tokens)
  └─ page (page.tokenOverrides)
       └─ section (sectionInstance.tokenOverrides)
```

Slot-level overrides are NOT permitted (Appendix F, decision D-1).

Resolution rules:

- `tokenOverrides` is a two-level map of `<group>` → `<name>` → `<value>`, same shape as `tokens` (§4.2).
- Resolution is **last-write-wins** along the cascade: section overrides page, page overrides site.
- An override map MAY include token names that are not declared at the site level. Such unknown names MUST be silently dropped per-name (the rest of the map still applies). Readers SHOULD emit a warning for each dropped name. Group-level rejection is not permitted: partial-shadow maps are valid. (Resolves v0.2 issue M7.)
- Renderers SHOULD emit scoped CSS custom property declarations on the page wrapper (for page overrides) and the section wrapper (for section overrides) so nested elements inherit naturally. For non-CSS renderers, scoping is implementation-defined but MUST preserve last-write-wins precedence.
- Token VALUE changes via `tokenOverrides` are non-breaking and MUST NOT bump `schemaVersion` (§11).

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
- `translatable`: `boolean` (default `false`) — see §4.9 / §13.4
- type-specific fields per §4.5

### 4.5 Slot type-specific fields

| Type | Required additional | Optional additional |
|------|---------------------|---------------------|
| `text` | — | `maxLength: number`, `pattern: string` (RegExp) |
| `richtext` | — | `format: "markdown" \| "portable-text"` (default `"markdown"`); see §4.5.1 |
| `asset` | — | `accept: string[]` from `["image", "video", "audio", "font", "svg", "pdf", "any"]` |
| `ref` | `refTo: string` (collection name) | — |
| `list` | `of: <ListItemType>` (see §4.5.2) | `min: number`, `max: number` |
| `struct` | `name: string` (struct name from `structs`) | — |
| `code` | — | `lang: string[]` (whitelist) |
| `number` | — | `min: number`, `max: number`, `integer: boolean` |
| `boolean` | — | — |

#### 4.5.1 `richtext` value discriminator (resolves v0.2 M1)

The value of a `richtext` slot is determined by JSON type:

- A JSON **string** is interpreted as Markdown (CommonMark + GFM) regardless of the `SlotDef.format` declaration. A schema declaring `format: "portable-text"` and receiving a string value is INVALID.
- A JSON **object** is interpreted as Portable Text. The object MUST have the shape `{ "format": "portable-text", "blocks": [ ... ] }`. Implementations MUST validate `blocks` per the Portable Text specification (out of scope for this spec; see [portabletext.org](https://portabletext.org)).

A parser MAY discriminate from the value alone (string vs. object) without consulting the `SlotDef`. Validators consult the `SlotDef` to confirm the declared format matches the actual value type.

#### 4.5.2 `list` item types

`list.of` is one of:
- `"text"`, `"richtext"`, `"asset"`, `"code"`, `"number"`, `"boolean"` — built-in scalar slot types
- `{ "kind": "ref", "refTo": "<collection>" }` — references to a collection
- `{ "kind": "struct", "name": "<structName>" }` — embedded structs

The legacy v0.1 string forms `"ref:<col>"` and `"struct:<name>"` are deprecated but MUST be accepted by Level 1 readers as synonyms. Level 2 writers MUST emit the object form. (Resolves a v0.2 nit about syntax collision with §7 ref syntax.)

### 4.6 Layout primitives

OPTIONAL on every `BlockType`. Renderers SHOULD interpret:
- `direction`: `"row"` | `"column"`
- `gap`: `"stack"` | `"block"` | `"section"` (corresponds to spacing tokens by convention)
- `align`: `"start"` | `"center"` | `"end"` | `"stretch"`

Unknown values MUST be ignored, not error.

### 4.6a `LayoutSpec`

The `layouts` map declares named layout templates that pages reference via `page.layout: "<name>"`. A `LayoutSpec` describes a responsive grid that section instances opt into via §5.1a. Support is OPTIONAL for Level 1 readers; readers MAY ignore `layouts` and stack sections vertically.

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
  - `gap`: `"stack"` | `"block"` | `"section"`
- `areas`: object mapping a breakpoint key (or `"default"`) to a 2-D array of area-name rows.

A `LayoutSpec` MAY have:
- `breakpoints`: object mapping a breakpoint key to a min-viewport-width integer (pixels). Keys MUST be `[a-z0-9]+`.
- `sectionDefaults`: object with `area: "<areaName>"` — fallback area for sections that don't declare `sectionLayout` (§5.1a).
- `description`: string

Constraints:
- Every area name used in `areas` MUST be referenceable from §5.1a `sectionLayout.area`.
- `areas.default` is REQUIRED if `breakpoints` is omitted; OPTIONAL otherwise (the smallest breakpoint's entry acts as default).
- Row counts MAY differ across breakpoints. Non-CSS renderers MUST flatten to a vertical stack ordered by document position in the source `sections[]` array, ignoring areas entirely. (Resolves v0.2 open question on row-count mismatch.)
- Renderers SHOULD implement `LayoutSpec` via CSS Grid.

Unknown fields in a `LayoutSpec` MUST be preserved by Level 2+ writers (§11.2).

### 4.7 `collections`

REQUIRED (MAY be empty). A `Collection` MUST have:
- `schema`: `string` — struct name from `structs` (or a built-in like `"blogPost"`)

A `Collection` MAY have:
- `indexBy`: `string` — record field to sort by
- `urlPattern`: `string` — pattern for record URLs (e.g. `"/blog/{slug}"`); omitted means records are embedded-only
- `layout`: `"single-file"` | `"records-on-path"` — preferred file layout. Implementations MUST accept both regardless of declared preference.

### 4.8 `structs` (OPTIONAL)

Reusable shape definitions referenced from `slots[].of` (lists), `slots[].name` (struct slots), and `collections[].schema`. Same shape as `BlockType.slots`.

### 4.9 `i18n` (OPTIONAL)

```json
{
  "defaultLocale": "en",                          // REQUIRED
  "locales": ["en", "fr", "es"],                  // REQUIRED, includes defaultLocale
  "routing": "prefix" | "subdomain" | "domain",   // REQUIRED
  "fallback": "default" | "404"                   // REQUIRED — applies to page-level only
}
```

#### 4.9.1 Fallback layers (resolves v0.2 M2)

Fallback applies at three layers, each with explicit semantics:

**Page-level** (governed by `i18n.fallback`):

- A reader receives a URL implying locale L for a page that exists only in the default locale.
- `fallback: "default"` → renderer SHOULD serve the default-locale page at the requested URL. The HTML lang attribute MUST reflect the actually-served locale.
- `fallback: "404"` → renderer MUST return a 404-equivalent. Renderers MUST NOT silently substitute.

**Slot-level (translatable slots):**

A slot declared `translatable: true` carries a per-locale value map: `{ "<locale>": <value>, ... }`.

- If the requested locale L has a value, use it.
- If L is missing AND the default locale has a value, fall back to the default-locale value. This is unconditional and does NOT consult `i18n.fallback` (which governs page-level only).
- If neither L nor the default locale has a value, the slot is treated as **empty** for validation purposes (§6).
- Readers MUST emit a warning for any per-locale fall-through.

**Record-level (translatable records):**

Records under a per-locale subdirectory (e.g. `content/blog/fr/<slug>.json`) follow the page-level rule. Records inline-translated (no per-locale subdir) follow the slot-level rule for each translatable slot.

---

## 5. Page records

A page record at `content/pages/<slug>.json`:

```json
{
  "title": "string",                              // REQUIRED
  "slug": "string",                               // REQUIRED, MUST start with "/" and match filesystem position
  "status": "draft" | "published",                // REQUIRED
  "sections": [<SectionInstance>, ...],           // REQUIRED (MAY be empty)

  "publishedVersion": "ISO timestamp",            // OPTIONAL — when this page was last published
  "publishedAt": "YYYY-MM-DD",                    // OPTIONAL — original publish date (editorial)
  "author": { "name": "...", "handle": "..." },   // OPTIONAL
  "seo": { "title": "...", "description": "...", "ogImage": "asset:..." },  // OPTIONAL
  "layout": "string",                             // OPTIONAL — references a layout from mosaic.json#layouts
  "tokenOverrides": { ... }                       // OPTIONAL — see §4.2a
}
```

Unknown fields MUST be preserved by Level 2+ writers (§11.2).

### 5.1 `SectionInstance`

```json
{
  "id": "string",                                 // REQUIRED, unique within page
  "blockType": "string",                          // REQUIRED, MUST be declared in mosaic.json
  "variant": "string",                            // OPTIONAL; if present, MUST be in blockType.variants
  "state": "draft" | "published",                 // OPTIONAL, default "published"
  "publishedHash": "string" | null,               // OPTIONAL, sha256 — see §12
  "slots": { "<slotName>": <value>, ... },        // REQUIRED
  "sectionLayout": <SectionLayout>,               // OPTIONAL
  "tokenOverrides": { ... }                       // OPTIONAL — see §4.2a
}
```

The `id` MUST be stable across edits. Renderers SHOULD use it as an HTML id or anchor.

#### 5.1.1 Draft × published interactions (resolves v0.2 M8)

When a published page contains a section with `state: "draft"`:

- The draft section MUST be excluded from the rendered output for non-editor consumers.
- The draft section MUST be excluded from `sectionLayout.area` assignment, position counters, and `before-section:<n>` / `after-section:<n>` global position resolution. Indices count published sections only.
- The draft section IS preserved in storage and visible to editors.
- The draft section's `publishedHash` is unaffected by its own draft status (the hash represents the section's last-published content; if never published, the field is null).

### 5.1a `sectionLayout` on a SectionInstance

A `SectionInstance` MAY include an OPTIONAL `sectionLayout`:

```json
{
  "sectionLayout": {
    "area": "content",
    "span": 8
  }
}
```

- `area`: REQUIRED if `sectionLayout` is present. MUST be an area name declared in the page's resolved `LayoutSpec.areas`.
- `span`: OPTIONAL integer — column span within the area (1–`grid.columns`). Useful when an area is wider than the section needs (e.g. a centered narrow block inside a full-width area).
- If `sectionLayout` is absent, the section falls into `LayoutSpec.sectionDefaults.area` (if declared) or default flow.
- If `area` references an unknown area name, renderers MUST fall back to `sectionDefaults.area`, then to default flow. Renderers SHOULD emit a warning.

### 5.2 `tokenOverrides` on page records

See §4.2a for full cascade semantics.

---

## 6. Validation

A Level 1 reader MUST validate every section it processes. A section is **invalid** if:

- `blockType` is not declared in `mosaic.json#blockTypes`
- `variant` is set and not in the block type's `variants`
- A `required: true` slot is empty per §6.2
- A slot value doesn't satisfy its type rules (§4.5)
- A `ref:` value points at a non-existent record
- A `list` slot's length is outside `[min, max]`

Invalid sections MUST NOT crash a reader. Readers MUST surface them via:
- A warnings channel (CLI, log, API field). MUST be machine-readable per RFC-2119.
- Optional refusal to render (configurable strictness). Implementations MAY refuse; if they MAY, they MUST document the strictness flag.

### 6.1 Silent skip — consumer capability declaration

Headless consumers (custom renderers, mobile apps, AI summarisers, search indexers, RSS feed builders) are partial views of a Mosaic document and typically implement only a subset of canonical block types. For these consumers, a `<missing template>` placeholder is the wrong default.

A consumer MAY declare a **supported block types set**. Such a consumer:

- MUST silently drop sections whose `blockType` is not in its supported set from the render output.
- MUST NOT emit a `<missing template>` placeholder for dropped sections.
- MUST NOT raise a validation warning for the unsupported `blockType` itself.
- MUST NOT run §6 validation on dropped sections (skip happens BEFORE validation — resolves v0.2 open question on validation order).
- SHOULD apply §6 validation for supported sections.
- SHOULD preserve unsupported sections in any pass-through serialisation (Level 2 round-trip) so that other consumers still see them. Silent skip applies to rendering, not to storage.

The canonical pattern is a `SKIP_BLOCKS` set consulted before rendering each section. `mosaic.json` MUST NOT declare per-consumer skip rules.

RECOMMENDED default-skip set for headless consumers: `["freeform"]` (see §10b.6). Implementations MAY add or remove from this set per their use case.

This contract is OPTIONAL for engine-default renderers, which SHOULD continue to surface unknown blocks per §6.

### 6.2 "Empty" semantics

A slot is **empty** when:

| Type | Empty if |
|------|----------|
| `text` / `richtext` / `code` | Value is `null`, missing, or empty string |
| `asset` / `ref` | Value is `null` or missing |
| `list` | Value is `null`, missing, or `[]` |
| `struct` | Value is `null` or missing. `{}` is NOT empty — it's a struct with all fields absent (validate fields individually). |
| `number` | Value is `null` or missing. `0` is NOT empty. |
| `boolean` | Value is `null` or missing. `false` is NOT empty. |

A `required: true` slot that is empty per the above table fails validation.

---

## 7. Reference resolution

Four reference shapes appear inside slot values (§7.1–§7.4). The full grammar, normalisation rules, and case-sensitivity behavior are in **Appendix C**. Resolution is recursive: values inside arrays and objects MUST be walked.

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

Algorithm:
1. Normalise per Appendix C.3 (trim, strip leading `./`, reject `..`, no empty segments, no trailing `/`).
2. Look up the normalised path in `assets/manifest.json#paths`. If found, set `sha256`.
3. Implementation determines `url`.
4. If the file is text (`.md`, `.json`, `.txt`, `.svg`) and present, readers MAY inline the body as `{ kind: "asset", ..., body: "<text>", inlined: true }`.

Server-only fields (e.g. local filesystem absolute paths) MUST NOT cross the network boundary.

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
1. Split on `/` → `<collection>`, `<id>`.
2. Locate the collection in either layout: `content/<collection>/<id>.json` (records-on-path) OR `content/collections/<collection>.json#entries[<id>]` (single-file).
3. Validate the record's shape against `collections[<collection>].schema`.

If unresolvable, the resolver MUST return:
```json
{ "kind": "ref-missing", "ref": "ref:blog/a-site-is-a-document" }
```

The `<id>` portion is the record's filename basename (without `.json`) or its key in the single-file layout. It is NOT the same as a record's `slug` field (slugs MAY differ from ids; only `id` is the resolver key).

### 7.3 `block:sha256-<hash>`

Engine-internal, content-addressed block bodies. Resolves to a `BlockContent` (§14). Mosaic does not require any particular block-body storage strategy. Implementations without content-addressed block storage MAY treat `block:` refs as `{ "kind": "block", "sha256": "<hash>", "content": null }`; this is fully conformant.

### 7.4 `asset:content/<path>.md`

Syntactically a §7.1 `asset-ref` (see Appendix C.2). Behaviorally, when a `.md` extension is detected on a resolved asset, readers SHOULD inline the body as CommonMark + GFM in the `body` field.

### 7.5 Circular references

If A.slot refs B, and B.slot refs A: the resolver MUST detect the cycle and return one ref as `kind: "record"` with full data, the other as `kind: "ref-cycle"` with just `{ kind, ref }`. MUST NOT infinite-loop.

### 7.6 Unknown reference shapes

If a reader encounters a ref string matching none of §7.1–§7.4, it MUST return `{ "kind": "ref-unknown", "ref": "<original-string>" }` and emit a warning. Level 2+ writers MUST preserve unknown ref strings unchanged on round-trip.

---

## 8. Asset manifest

`assets/manifest.json`:

```json
{
  "version": 1,
  "updated": "ISO timestamp",
  "paths": { "<relative-path-under-assets/>": "sha256-<hash>" }
}
```

If `assets/` exists, `manifest.json` MUST exist. A site with `assets/` and no `manifest.json` is INVALID; Level 1 readers MUST surface this as a validation error. (Resolves v0.2 C7; replaces v0.1 §8's SHOULD-tolerate clause, which contradicted §3.)

Sha256 is informational: it enables dedup and survives renames (manifest path can change, refs stay valid as long as the path entry resolves). Implementations MUST trust the path as primary; sha256 is for verification.

The sha256 computation is defined in §12.3.

If a `asset:` ref's path is not in the manifest, the resolver MUST emit a warning AND attempt resolution relative to the assets directory. If the file exists on disk but not in the manifest, the resolver returns `sha256: null` and proceeds.

---

## 9. Globals (OPTIONAL)

Globals are named, schema-declared site-wide singletons that the renderer injects at canonical positions across every page. They are NOT hard-coded to specific names.

### 9.1 Declaration

```json
"globals": {
  "<id>": {
    "blockType": "<blockTypeName>",     // REQUIRED
    "position": "<position-spec>",      // REQUIRED — see §9.2
    "instance": "<path-to-record>",     // REQUIRED — e.g. "globals/site-header.json"
    "repeat": <repeat-spec>,            // OPTIONAL, default false
    "above": "<other-global-id>",       // OPTIONAL — relative ordering hint
    "below": "<other-global-id>"        // OPTIONAL — relative ordering hint
  }
}
```

### 9.2 Position vocabulary

| Value | Meaning |
|-------|---------|
| `"page-top"` | Above all sections on every page |
| `"page-bottom"` | Below all sections on every page |
| `"page-side-left"` | Sidebar to the left of content (desktop); stacked at top (mobile) |
| `"page-side-right"` | Sidebar to the right of content (desktop); stacked at top (mobile) |
| `"before:<global-id>"` | Immediately before another global |
| `"after:<global-id>"` | Immediately after another global |
| `"before-section:<n>"` | Before published section at index `n` |
| `"after-section:<n>"` | After published section at index `n` |

Unknown positions MUST fall back to `"page-bottom"` and emit a warning. The `<n>` in `before-section`/`after-section` counts published sections only (§5.1.1).

### 9.3 Ordering when multiple globals share a position (resolves v0.2 M4)

When two or more globals declare the same absolute position (e.g. both `"page-top"`) AND neither declares `above` or `below`, renderers MUST order them by their key order in `mosaic.json#globals`. JSON object key order is preserved by all major parsers since ES2015; writers MUST preserve key order in round-trip.

When `above` / `below` hints are present, they take precedence over key order. Conflicting hints (cycle) MUST surface as a validation warning; renderers MUST fall back to key order.

### 9.4 Repeat vocabulary

| Value | Meaning |
|-------|---------|
| `false` (default) | Render once at the declared position |
| `true` | Render at every defined position match |
| `"every N sections"` | Interleave a copy after every N sections |
| `"every N pixels"` | (Renderer-specific) inject at scroll intervals |

### 9.5 Per-page override (resolves v0.2 M3)

A page record MAY include `globalsOverride` to alter global rendering on that page only. The value is a map of global id to override directive:

```json
{
  "title": "...",
  "globalsOverride": {
    "site-footer":   "off",
    "site-header":   "override",
    "newsletter-cta": { "instance": "globals/cta-special.json" }
  }
}
```

Each value is one of:

- `"off"` — disable for this page.
- `"override"` — page provides its own section of the same `blockType` inline; renderer MUST NOT also inject the global at its declared position.
- `{ "instance": "<other-path>" }` — render the global at its declared position, but swap to the named instance file.

A global id MUST appear at most once per `globalsOverride` map. (Resolves the v0.2 illegal-duplicate-keys example.)

`globalsOverride` is OPTIONAL to implement; a renderer that ignores it still complies.

### 9.6 Instance content shape

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

### 9.7 Conformance

Globals support is OPTIONAL for Level 1 readers. A renderer that doesn't implement globals injection is still spec-compliant.

---

## 10. Overlays (OPTIONAL)

Overlays are off-flow page elements: lightboxes, popups, modals, drawers, toasts.

### 10.1 Declaration

```json
"overlays": {
  "<id>": {
    "blockType": "<overlayBlockType>",    // REQUIRED
    "instance": "<path-to-record>",       // OPTIONAL
    "trigger": "<trigger-spec>",          // REQUIRED
    "persist": "<persist-spec>"           // OPTIONAL
  }
}
```

### 10.2 Trigger vocabulary

| Value | Meaning |
|-------|---------|
| `"manual"` | Only opens via in-content link `#overlay:<id>` |
| `"auto-image-links"` | Lightbox-specific — wraps every image/asset ref in a click handler |
| `"scroll:N%"` / `"scroll:Npx"` | Triggers at N percent / N pixels of scroll |
| `"delay:Nms"` | After N milliseconds |
| `"exit-intent"` | Mouse toward browser chrome / tab close |
| `"first-visit"` | First page view per `persist` window |
| `"every-visit"` | Every page view |

### 10.3 Persist vocabulary

| Value | Meaning |
|-------|---------|
| `"session"` | Until page reload / tab close |
| `"forever"` | Indefinitely (localStorage) |
| `"dismissed-for-7d"` etc. | Time-window dismissal |

Default: `"session"` for ephemeral overlays (toast, exit-intent), `"forever"` for declarative consents (cookieConsent).

### 10.4 Canonical overlay block types

`lightbox`, `modal`, `drawer`, `newsletterPopup`, `cookieConsent`, `exitOffer`, `toast`. Unknown overlay block types render via the standard fallback (per §6.1 for headless consumers, `<missing template>` for engine-default renderers).

### 10.5 Manual trigger linking

In-content links of the form `<a href="#overlay:<id>">` SHOULD open the named overlay.

### 10.6 Conformance

Overlays support is OPTIONAL for Level 1 readers.

---

## 10a. Outer / inner layout pattern (RECOMMENDED render guidance)

Renderers SHOULD follow the **outer / inner** pattern for block markup so backgrounds can stretch edge-to-edge while content stays within a content cage:

```html
<section class="block <blockType> <blockType>--<variant>">
  <div class="block__inner">...block content...</div>
</section>
```

- `.block` fills viewport width; backgrounds paint wall-to-wall.
- `.block__inner` constrains content. Recommended: `max-width: 1200px; margin: 0 auto; padding: 0 clamp(1rem, 4vw, 2rem);`

Full-bleed variants (`hero--fullbleed`) MAY omit `.block__inner`.

This pattern is OPTIONAL — renderers MAY use a single-container layout. Guidance lives here because the pattern is well-tested.

---

## 10b. `freeform` canonical block type

`freeform` is the spec's documented escape hatch for design-heavy content: covers, editorial inserts, posters, hero illustrations, art-directed callouts.

### 10b.1 Declaration

```jsonc
"blockTypes": {
  "freeform": {
    "variants": ["default"],
    "slots": {
      "aspect": { "type": "text", "required": true },              // e.g. "16/9"
      "units":  { "type": "text", "required": true },              // "percent" | "px"  — canvas-level
      "items":  { "type": "list", "of": { "kind": "struct", "name": "freeformItem" }, "required": true }
    }
  }
},
"structs": {
  "freeformItem": {
    "kind":     { "type": "text", "required": true },              // "text" | "asset" | "shape"
    "position": { "type": "struct", "name": "freeformPosition", "required": true },
    "slots":    { "type": "struct", "name": "freeformItemSlots" }
  },
  "freeformPosition": {
    "x":        { "type": "number", "required": true },
    "y":        { "type": "number", "required": true },
    "w":        { "type": "number", "required": true },
    "h":        { "type": "number", "required": true },
    "z":        { "type": "number" },
    "rotation": { "type": "number" }
  },
  "freeformItemSlots": {
    "text":   { "type": "richtext" },
    "asset":  { "type": "asset" },
    "shape":  { "type": "text" },
    "fill":   { "type": "text" },
    "stroke": { "type": "text" }
  }
}
```

### 10b.2 Slots

- `aspect`: REQUIRED string `"<W>/<H>"`.
- `units`: REQUIRED — `"percent"` or `"px"`. **Canvas-level** (single basis for the whole canvas). Mixing per-item is not permitted. (Resolves v0.2 M6.)
- `items`: REQUIRED list (MAY be empty).

### 10b.3 Item kinds

- `"text"` — `slots.text` (richtext) renders inside the positioned box.
- `"asset"` — `slots.asset` (asset ref) renders inside the box.
- `"shape"` — `slots.shape` names a primitive. Renderers SHOULD implement `"rect"` and `"circle"`. Unknown shapes MUST be ignored.

### 10b.4 Coordinate system

- `units: "percent"` — values are 0–100, relative to the canvas's resolved width/height.
- `units: "px"` — values are absolute pixels at the canvas's declared aspect. Renderers SHOULD scale via CSS transform.

`z` is an integer; higher values render on top. Items with no `z` render in document order, all below items that declare `z`.

`rotation` is in degrees clockwise.

### 10b.5 Rendering

The canvas MUST establish its own positioning context (`position: relative` or equivalent). Items render absolutely against it.

### 10b.6 Portability

`freeform` is the LEAST portable canonical block. Headless consumers (§6.1) — RSS, search, AI summarisers, mobile native — RECOMMENDED to include `"freeform"` in their default skip set. (Promoted from SHOULD per v0.2 open question.)

Authors SHOULD prefer composing standard blocks where possible.

---

## 11. Versioning and migration

### 11.1 Spec versioning

Mosaic version (this spec) is independent of `mosaic.json#meta.schemaVersion`.

- Spec versions `0.x` — breaking changes possible
- Spec versions `1.0` and later — semver semantics

A site's `schemaVersion` MUST bump on:
- Adding or removing a `blockType`
- Changing a `SlotDef` type or `required` flag
- Renaming variants
- Token group additions/removals (token VALUE changes do NOT bump)

Block-type evolutions (e.g. renaming a slot) are implementation-defined.

### 11.2 Forward and backward compatibility (resolves v0.2 schema migration gap)

A site declares its target spec version via `mosaic.json#meta.mosaicVersion`. Readers compare this against their supported spec version:

- **Same major, same or lower minor** (e.g. reader supports `0.3`, site declares `0.2` or `0.3`): Reader MUST process normally.
- **Same major, higher minor** (reader supports `0.3`, site declares `0.4`): Reader MUST attempt to process. Unknown fields anywhere MUST be preserved (Level 2+) and ignored for behavior. Reader SHOULD emit a warning naming the version gap.
- **Different major** (reader supports `0.x`, site declares `1.x`, or vice versa): Reader MAY refuse to process. If it processes, it MUST emit a warning. Readers MUST NOT silently downgrade behavior.

### 11.3 Unknown field preservation (universal rule)

Unknown fields anywhere in a Mosaic document — `mosaic.json`, page records, section instances, slot values, struct values, global instance files, manifest, etc. — MUST be preserved by Level 2+ writers on round-trip. This is the universal forward-compat guarantee, restated here instead of repeated section-by-section. (Resolves v0.2 underspec item on scattered preservation rules.)

---

## 12. Canonical hashing

Several Mosaic fields rely on stable cryptographic hashes that MUST be computable identically across implementations: `SectionInstance.publishedHash` (§5.1), `assets/manifest.json#paths` sha values (§8), and the `block:sha256-<hash>` reference shape (§7.3).

### 12.1 Canonical JSON encoding

Implementations MUST encode JSON-shaped Mosaic content via **JSON Canonicalisation Scheme (JCS)**, [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785):

- Object keys are sorted lexicographically by UTF-16 code-unit order.
- No insignificant whitespace.
- Numbers per I-JSON (ECMA-262 `Number.prototype.toString`).
- Strings use shortest UTF-8 encoding; only RFC 8259 required escapes.

### 12.2 `publishedHash` computation

For a `SectionInstance` whose `state` is `"published"`:

1. Take the section's `slots` object (the value under the `slots` key, not the whole section).
2. Include any unknown fields preserved per §11.3.
3. Exclude all surrounding section metadata (`id`, `blockType`, `variant`, `state`, `publishedHash`, `sectionLayout`, `tokenOverrides`).
4. Encode via JCS (§12.1).
5. Compute SHA-256 over the UTF-8 bytes.
6. `publishedHash` is the lowercase hex string of the digest (64 chars, no prefix).

Sections with `state: "draft"` MUST set `publishedHash` to `null` or omit it.

A writer SHOULD recompute `publishedHash` whenever it transitions a section from draft to published, or modifies the slot content of an already-published section. Readers MAY use the field for integrity checks; mismatches MUST surface as warnings, not errors.

### 12.3 Asset manifest sha256

The sha256 values in `assets/manifest.json#paths` are computed over the **raw bytes** of the asset file. Format: `"sha256-<lowercase 64-hex>"`. Manifest claims that don't match actual bytes MUST surface as warnings.

### 12.4 `block:sha256-<hash>` derivation

The `<hash>` is the lowercase 64-hex SHA-256 of the JCS-canonical encoding of the referenced `BlockContent` (§14).

### 12.5 Conformance

Level 1 readers MAY ignore `publishedHash` entirely. Level 2 writers SHOULD compute and emit it. Level 3 engines MUST compute and maintain it.

---

## 13. Concurrent edits and merge semantics

This section is required only for Level 3 engines. It defines what "preserve concurrent edits without data loss" means concretely. (Resolves v0.2 underspec gap on L3 conformance.)

### 13.1 Concurrent operation model

A Level 3 engine MUST treat each independent write to a document as an **operation** with:

- A target — slot value, section instance, page record, or `mosaic.json` field.
- A logical timestamp — Lamport or hybrid logical clock; comparable across replicas.
- An author identifier.

Two operations are **concurrent** if neither's logical timestamp dominates the other.

### 13.2 Per-slot-type merge rules

For concurrent edits to the same slot:

| Slot type | Merge rule |
|-----------|------------|
| `text` (string body) | Last-write-wins by logical timestamp |
| `richtext` (markdown string) | Last-write-wins by logical timestamp |
| `richtext` (portable-text object) | Per-block LWW, keyed by `_key`. Concurrent edits to different blocks MUST preserve both. |
| `code` | Last-write-wins by logical timestamp |
| `number`, `boolean`, `asset`, `ref` | Last-write-wins |
| `list` (scalar items) | Engine MAY implement positional CRDT or LWW; if LWW, the whole list value replaces. Engines targeting collaborative authoring SHOULD implement positional CRDT (Yjs / Loro style). |
| `list` (struct or ref items with stable `id`) | Per-element LWW, keyed by `id`. Concurrent additions MUST preserve both. |
| `struct` | Per-field LWW |

### 13.3 Section-level concurrency

Concurrent operations on different slots of the same section MUST all be preserved (per slot rules above). Concurrent operations on different sections of the same page MUST all be preserved.

Concurrent deletion vs. edit of the same section: the deletion wins. Concurrent identical deletion: idempotent. Concurrent deletion of an ancestor (page) vs. edit of a descendant (section): the page deletion wins.

### 13.4 Translatable slot concurrency

Concurrent edits to different locales of a translatable slot MUST be preserved (the per-locale value map is treated as a struct of per-field LWW, where each locale key is a field).

### 13.5 `publishedHash` and concurrency

Publishing is itself an operation. Concurrent publishes resolve by logical timestamp; the latest published state wins. `publishedHash` MUST be recomputed (§12.2) by the engine that resolves the merge.

### 13.6 Conformance test

A Level 3 engine's conformance can be demonstrated by replay: given two divergent operation logs A and B, the engine MUST produce the same final document state regardless of which log is applied first. Test vectors are non-normative but reference vectors live in the Clear repo under `examples/l3-conformance/`.

---

## 14. Block content storage (engine-defined contract)

`block:sha256-<hash>` references (§7.3) resolve to `BlockContent`. Mosaic does not require any particular block-body storage strategy; engines MAY store content-addressed bodies under `blocks/sha256/<hash>/content.json` (§3) for deduplication, history, or collaboration.

### 14.1 Minimal `BlockContent` shape (resolves v0.2 M5)

```json
{
  "slots": { "<slotName>": <value>, ... }   // REQUIRED — same shape as SectionInstance.slots
}
```

A `BlockContent` MUST have a `slots` field with the same shape and constraints as `SectionInstance.slots` (§5.1). The block type is determined by the referring section, not stored inside the `BlockContent` itself.

### 14.2 Engine-specific extensions

Engines MAY add additional top-level fields (e.g. `_meta`, `_history`, `_authors`). Such fields are engine-internal; Mosaic does not standardize them. Level 2+ writers from one engine to another MUST preserve unknown fields (§11.3) so engine-specific data is not lost in round-trip.

### 14.3 Resolution

When a `block:sha256-<hash>` resolves:
- Engines with backing storage: return `{ "kind": "block", "sha256": "<hash>", "content": <BlockContent> }`.
- Engines without backing storage: return `{ "kind": "block", "sha256": "<hash>", "content": null }`. This is conformant.

---

## 15. The reference implementation

[Clear](https://github.com/clearcms/clear) is a Level 3 implementation:
- Parser + validator: `@clear/core` (parser) + `@clear/schema` (validator)
- Reference resolver: `@clear/render`
- Render adapter: `@clear/render-astro` + an HTML adapter in `@clear/render`
- CRDT engine: `@clear/core/loro.mjs`
- Headless API: dev server's `/api/v1/...`
- CLI: `clear init / dev / push / pull / render / validate / info / roundtrip / import-astro`

Other implementations are encouraged. Open an issue to be listed.

---

## 16. Open questions for v0.4+

The following are intentionally deferred from v0.3. v0.3 ships without them.

- **Translation key serialization** — translatable slot path conventions for nested structs.
- **Asset access controls** — per-asset auth / visibility scopes.
- **Plugin / extension blocks** — third-party block types: sandboxing, identifier namespacing.
- **Portable Text full adoption** — what subset of Portable Text marks/styles a Level 1 reader MUST support.
- **Pre-bundled block library** — a canonical "starter" set of block types (hero, columns, gallery, etc.) shipped as a separate normative document.
- **Mosaic over the wire** — JSON-RPC / GraphQL / HTTP contract for fetching Mosaic content remotely.

---

## Appendix A — Example sites

The [Clear engine repo](https://github.com/clearcms/clear) includes:
- `examples/minimal-site/` — smallest valid Mosaic site
- `examples/blog-site/` — blog collection demonstrating `ref:` + body markdown
- `examples/l3-conformance/` — Level 3 merge replay vectors

The [Clear marketing site repo](https://github.com/clearcms/marketing-site) is itself a Mosaic site under Apache 2.0 — the largest real-world example.

---

## Appendix B — Change log

- **v0.3 (2026-05-11, draft)** — full revision in response to v0.2-draft peer review. Adds: §0 Terminology, §11.2 forward/backward compatibility rules, §13 concurrent-edit merge semantics (resolves L3 unfalsifiability), §14 BlockContent shape, §4.5.1 richtext discriminator, §4.5.2 list type forms, §6.2 empty-semantics table, §9.3 globals ordering rule, §9.5 globalsOverride typed union, §10b.2 freeform canvas-level units, §11.3 universal unknown-field preservation. Resolves: v0.2 issues C1, C2, C3, C4, C5, C6, C7, M1–M8, and the L3 merge gap. Carries forward: §4.2a / §4.6a / §5.1a / §5.2 / §6.1 / §10a / §10b / §12 / Appendix C from v0.2-draft + post-review fixes.
- **v0.2 (2026-05-11, draft — superseded by v0.3)** — additive: LayoutSpec body, tokenOverrides cascade, freeform block, silent skip, outer/inner pattern. Post-peer-review fixes followed. Never released; v0.3 is the public successor to v0.1.
- **v0.1 (2026-05-10)** — first published spec.

---

## Appendix C — Reference string grammar

This appendix is **normative**. It defines the syntactic shape, character classes, and normalisation rules for the four reference shapes resolved in §7.

### C.1 Grammar (ABNF)

ABNF per [RFC 5234](https://www.rfc-editor.org/rfc/rfc5234).

```abnf
ref-string      = asset-ref / record-ref / block-ref

asset-ref       = "asset:" asset-path
record-ref      = "ref:" collection "/" record-id
block-ref       = "block:sha256-" sha256-hex

asset-path      = path-segment *( "/" path-segment )
path-segment    = 1*( ALPHA / DIGIT / "_" / "-" / "." )

collection      = 1*( ALPHA / DIGIT / "_" / "-" )
record-id       = 1*( ALPHA / DIGIT / "_" / "-" / "." )

sha256-hex      = 64HEXDIG    ; lowercase only ("a"-"f", not "A"-"F")
```

### C.2 Special form — Markdown body assets (§7.4)

The reference `asset:content/<path>.md` is **syntactically** an `asset-ref`. Its specialness is purely **behavioural**: a Level 1 reader detecting the `.md` extension SHOULD inline the body as CommonMark + GFM.

### C.3 Normalisation

Before resolution (§7), all ref strings MUST be normalised:

1. **Trim.** Leading/trailing ASCII whitespace stripped. Internal whitespace remains invalid per C.1.
2. **Strip leading `./`** in asset paths. Repeated `./` all stripped.
3. **Reject `..` segments.** Path traversal is INVALID; surface as ref-missing.
4. **No trailing slash** on `asset-path`. INVALID.
5. **No empty segments** (`//`). INVALID.

### C.4 Case sensitivity

Reference strings are **case-sensitive**. On case-insensitive filesystems, a manifest entry differing only in case MUST be a resolution failure with warning, not a silent match.

### C.5 Examples

Valid:
```
asset:images/hero.jpg
asset:content/blog/a-site-is-a-document.md
asset:./images/logo.svg              ; normalises to "asset:images/logo.svg"
ref:blog/a-site-is-a-document
block:sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Invalid:
```
asset:images//hero.jpg               ; empty segment
asset:images/                        ; trailing slash
asset:../etc/passwd                  ; ".." traversal
asset:images/hero with space.jpg     ; internal whitespace
ref:blog/2026-05-09/hello            ; "/" in record-id
block:sha256-ABCDEF...               ; uppercase hex
```

### C.6 Future-compatibility

Unknown ref shapes MUST return `{ "kind": "ref-unknown", "ref": "<original>" }` and emit a warning. Level 2+ writers MUST preserve unknown ref strings on round-trip.

---

## Appendix D — JSON Schema for `mosaic.json`

A formal JSON Schema 2020-12 document for `mosaic.json` lives at `mosaic.schema.json` in the repo root. Sketch of the top-level shape:

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://clearcms.github.io/mosaic/v0.3/mosaic.schema.json",
  "type": "object",
  "required": ["meta", "blockTypes", "collections"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["name", "mosaicVersion", "schemaVersion"],
      "properties": {
        "name": { "type": "string" },
        "mosaicVersion": { "type": "string", "pattern": "^\\d+\\.\\d+(\\.\\d+)?$" },
        "schemaVersion": { "type": "integer", "minimum": 1 },
        "domain": { "type": "string" }
      }
    },
    "tokens":      { "$ref": "#/$defs/TokenMap" },
    "blockTypes":  { "$ref": "#/$defs/BlockTypeMap" },
    "collections": { "$ref": "#/$defs/CollectionMap" },
    "structs":     { "$ref": "#/$defs/StructMap" },
    "i18n":        { "$ref": "#/$defs/I18n" },
    "layouts":     { "$ref": "#/$defs/LayoutSpecMap" },
    "globals":     { "$ref": "#/$defs/GlobalMap" },
    "overlays":    { "$ref": "#/$defs/OverlayMap" }
  },
  "$defs": {
    "TokenMap":      "...",
    "BlockTypeMap":  "...",
    "CollectionMap": "..."
    // ... full schema in mosaic.schema.json
  }
}
```

The JSON Schema covers static shape only. Runtime semantics (e.g. "every `blockType` referenced in a section MUST be declared") still live in this spec text and are not encodable in JSON Schema.

Conformance: implementations MAY validate `mosaic.json` against this schema as a fast-path. Implementations MUST still perform spec-text validation per §6 because the schema is a subset.

---

## Appendix E — Recommended token groups (non-normative)

Sites are not required to use any specific token group names. The following are recommended by convention so that block types written for one Mosaic site can be ported to another with minimal token re-mapping:

`color` · `font` · `size` · `space` · `radius` · `shadow` · `leading` · `tracking` · `weight` · `duration` · `ease`

Block libraries that target portability across sites SHOULD use these group names.

---

## Appendix F — Decision log (v0.3)

Every design call made in this revision where the v0.1 / v0.2 spec was silent or contradictory. Listed so you can override any single one without unraveling the rest.

| ID | Decision | Reasoning | Where to override |
|----|----------|-----------|---------------------|
| **D-1** | Slot-level `tokenOverrides` REJECTED. Section is the narrowest scope. | Bloats every slot value schema; conflicts with translatable slot serialisation; same effect achievable at section. | §4.2a |
| **D-2** | `richtext` value-level discriminator = JSON type. String → markdown; object with `{format, blocks}` → portable-text. | Lets parsers dispatch without consulting schema; matches Sanity's wire shape. | §4.5.1 |
| **D-3** | `list.of` rewritten as typed objects `{kind, ...}`; v0.1 prefix-colon strings are deprecated synonyms. | Removes collision with §7 ref syntax. | §4.5.2 |
| **D-4** | i18n fallback split into three layers: page (governed by `i18n.fallback`), slot (always falls to default-locale), record (per-locale subdir vs. inline). | Each layer has different real-world needs; one knob can't cover all three. | §4.9.1 |
| **D-5** | Empty `blockTypes` + no `pages/` directory = valid zero-content document. | Format specs without a minimal example are surprising. | §3.1 |
| **D-6** | Manifest absent + `assets/` present = INVALID, not SHOULD-tolerate. | Removes the §3 vs §8 self-contradiction. Implementations needing tolerance MAY add it as an extension; spec says strict. | §8 |
| **D-7** | Draft sections excluded from layout assignment, position counters, and indices. | Otherwise editing a draft changes the rendered position of every published section after it — a publish-time gotcha. | §5.1.1 |
| **D-8** | Multiple globals at same position with no `above`/`below` → ordered by JSON object key order. | All major parsers preserve key order; writers MUST preserve. Less surprising than alphabetical or implementation-defined. | §9.3 |
| **D-9** | `globalsOverride` rewritten as typed union per-id. Each id appears at most once. | Removes the illegal-duplicate-keys example. | §9.5 |
| **D-10** | `freeform.units` promoted from per-item to canvas-level. | Removes the rescale-undefined case; per-item mixing wasn't a real authoring need. | §10b.2 |
| **D-11** | `freeform` in headless default-skip = RECOMMENDED (not SHOULD). | Strong consensus from review; matches actual headless implementations. | §10b.6 |
| **D-12** | `tokenOverrides` partial-shadow case: drop unknown names per-name; rest of map applies. | The alternative (drop whole map on any unknown) is strictly worse for authoring. | §4.2a |
| **D-13** | `mosaicVersion` field added to `meta`. Forward-compat rules in §11.2. | Without this, a renderer can't tell what version it's reading. | §4.1 / §11.2 |
| **D-14** | L3 merge semantics defined per-slot-type. Default LWW; portable-text per-block LWW by `_key`; lists with id'd items per-element LWW; positional lists implementation-choice. | Yjs/Loro consensus. Lets engines claim L3 conformance with a checkable contract. | §13.2 |
| **D-15** | Concurrent delete vs. edit → delete wins. Concurrent delete + ancestor delete → ancestor wins. | Yjs convention. The alternative ("edit wins") makes deletions unreliable. | §13.3 |
| **D-16** | Canonical JSON = RFC 8785 JCS for hashing. | Industry default for canonical JSON. | §12.1 |
| **D-17** | `publishedHash` over `slots` only; unknown fields included. | Section metadata changes (e.g. variant rename) shouldn't bump the hash; unknown fields included to preserve round-trip stability. | §12.2 |
| **D-18** | `BlockContent` minimal shape = `{ slots }` only. Engines MAY extend with engine-specific fields. | Spec defines the portable surface; engines own the rest. | §14.1 |
| **D-19** | Refs case-sensitive; case-insensitive filesystems fail-loud-not-silent on case mismatch. | Unix-aligned; silent collision is a known footgun in cross-platform projects. | Appendix C.4 |
| **D-20** | Ref `..` traversal rejected outright at normalisation. | Security; no traversal is ever desired. | Appendix C.3 |
| **D-21** | `mosaic.schema.json` shipped as static-shape validator; runtime semantics still live in spec text. | JSON Schema can't express "blockType MUST be declared"; trying to encode it produces a worse spec. | Appendix D |

---

*End of spec. Read Appendix F first for the design log. `REVIEW.md` documents the v0.2 peer review that motivated this revision.*
