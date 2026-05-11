# Mosaic — normative specification (v0.5)

**Version:** 0.5
**License:** CC0 1.0 Universal
**Status:** Current. Supersedes v0.1, v0.2-draft, and the v0.3 proposal.

Mosaic is a portable document format for structured web content. A Mosaic document is a directory tree on disk that any conforming reader can parse, validate, and render. The format is independent of any rendering engine.

This document is the validator's-eye view: closed taxonomies, conformance levels, resolution algorithms, edge cases. The [README](README.md) is the introduction.

Keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY** follow [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

A **decision log** is in Appendix F. Read that first if you want to know what got cut from v0.3-proposal and why.

This is a 0.x release. Breaking changes between minor versions are possible until v1.0.

---

## 0. Terminology

- **Mosaic document** — a directory tree conforming to §3. Sometimes called a "site."
- **Page** — a record under `content/pages/` that defines a URL-addressable page (§5).
- **Record** — any JSON file under `content/` that follows a declared shape. Pages are records; collection entries are records.
- **Section** — one block instance placed on a page (§5.1).
- **Slot** — a typed field on a block type; the unit of content storage (§4.4).
- **Block type** — a reusable section shape declared in `mosaic.json#blockTypes` (§4.3).
- **Token** — a design value (color, font, size, etc.) declared in `mosaic.json#tokens` (§4.2).
- **Reference** — a typed string value (`asset:...`, `ref:...`) that resolves to other content. Grammar in Appendix C; resolution in §7.
- **Reader** — an implementation that consumes Mosaic and produces output. Readers claim a conformance level (§1).
- **Writer** — an implementation that produces Mosaic output.
- **Consumer** — any reader, including partial readers like search indexers and RSS builders. Subject to validation (§6) and silent-skip (§6.1) rules.
- **Conformant** — an implementation that satisfies all MUST/MUST NOT requirements at its declared conformance level.
- **`mosaicVersion`** — the spec version a Mosaic document targets, declared in `mosaic.json#meta.mosaicVersion`. Used for migration (§9.2).

---

## 1. Conformance levels

Implementations claim a **conformance level**. A Mosaic-conformant implementation MUST clearly document its level.

### 1.1 Level 1 — Reader

An implementation that consumes Mosaic and renders or processes the content. MUST:

- Parse the file tree per §3
- Validate `mosaic.json` against §4 and validate each content record against §5
- Resolve references per §7 (per the grammar in Appendix C)
- Handle assets per §8
- Apply forward-compatibility rules per §9.2 when `mosaicVersion` exceeds the implementation's supported version

MAY produce HTML, JSON, native UI, print, anything.

### 1.2 Level 2 — Reader + Writer

Level 1 + MUST be able to produce Mosaic output: write `mosaic.json` and content files such that another Level 1 implementation reads them without raising any error AND produces no validation warnings for content that originated as valid Mosaic. Level 2 writers MUST preserve unknown fields anywhere in a Mosaic document (§9.3).

Engines that support concurrent live editing (CRDT-backed engines, collaborative editors) are out of scope for this version of the spec. Such engines are Level 2 implementations from Mosaic's perspective; their internal concurrency model is engine-defined.

---

## 2. Filesystem and encoding

- Files MUST be UTF-8 encoded. JSON files SHOULD have a trailing newline.
- Directory and file names MUST match `[a-z0-9_-]+` for identifiers. `/` is the directory separator. On Windows filesystems, implementations MUST translate `\` to `/` when serialising paths in JSON.
- File extensions: `.json`, `.md` for content; binary assets use their native extension.
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
│  ├─ pages/                         # OPTIONAL — page records
│  │  └─ <slug>.json
│  ├─ <collection>/                  # OPTIONAL — records-on-path layout
│  │  └─ <record-id>.json
│  └─ collections/                   # OPTIONAL — single-file collection layout
│     └─ <collection>.json
└─ assets/                           # OPTIONAL
   ├─ manifest.json                  # REQUIRED if and only if assets/ exists (§8)
   └─ <human-paths-to-binaries>
```

Implementations MUST NOT fail if OPTIONAL directories are absent. Implementations MAY emit warnings.

Engines MAY add additional top-level directories (e.g. `blocks/`, `snapshots/`, `globals/`) for engine-internal use. Such directories are not part of the portable document; readers from other engines MUST ignore them.

### 3.1 The zero-content valid document

A Mosaic document with `mosaic.json` containing valid `meta` + empty `blockTypes: {}` + empty `collections: {}`, and no `content/` or `assets/` directories, IS conformant. Pages are not REQUIRED. This is the minimal valid Mosaic document.

---

## 4. `mosaic.json` (the site schema)

```
{
  "meta":          { "name": "...", "mosaicVersion": "0.5", "schemaVersion": 1, "domain": "..."? },
  "tokens":        { "<group>": { "<name>": "<value>", ... }, ... }?,
  "blockTypes":    { "<typeName>": <BlockType>, ... },
  "collections":   { "<name>": <Collection>, ... },
  "structs":       { "<name>": <Struct>, ... }?,
  "i18n":          <I18n>?
}
```

### 4.1 `meta`

REQUIRED. Keys:

- `name` (string, REQUIRED) — human-readable site name
- `mosaicVersion` (string, REQUIRED) — spec version this document targets (e.g. `"0.5"`). See §9.2.
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

Resolution rules:

- `tokenOverrides` is a two-level map of `<group>` → `<name>` → `<value>`, same shape as `tokens` (§4.2).
- Resolution is **last-write-wins** along the cascade: section overrides page, page overrides site.
- An override map MAY include token names that are not declared at the site level. Such unknown names MUST be silently dropped per-name (the rest of the map still applies). Readers SHOULD emit a warning for each dropped name.
- Renderers SHOULD emit scoped CSS custom property declarations on the page wrapper (for page overrides) and the section wrapper (for section overrides) so nested elements inherit naturally. For non-CSS renderers, scoping is implementation-defined but MUST preserve last-write-wins precedence.
- Token VALUE changes via `tokenOverrides` are non-breaking and MUST NOT bump `schemaVersion` (§9).

### 4.3 `blockTypes`

REQUIRED (MAY be empty). A `BlockType` MUST have:

- `variants`: `string[]` — closed set of variant identifiers (MAY be empty)
- `slots`: `{ <slotName>: <SlotDef>, ... }` — slot definitions

A `BlockType` MAY have:

- `description`: string

### 4.4 `SlotDef`

A `SlotDef` MUST have `type` from the closed set: `text` · `richtext` · `asset` · `ref` · `list` · `struct` · `code` · `number` · `boolean`

Each `SlotDef` MAY have:

- `required`: `boolean` (default `false`)
- `description`: `string`
- `translatable`: `boolean` (default `false`) — see §4.8
- type-specific fields per §4.5

### 4.5 Slot type-specific fields

| Type | Required additional | Optional additional |
| --- | --- | --- |
| `text` | — | `maxLength: number`, `pattern: string` (RegExp) |
| `richtext` | — | `format: "markdown" \| "portable-text"` (default `"markdown"`); see §4.5.1 |
| `asset` | — | `accept: string[]` from `["image", "video", "audio", "font", "svg", "pdf", "any"]` |
| `ref` | `refTo: string` (collection name) | — |
| `list` | `of: <ListItemType>` (see §4.5.2) | `min: number`, `max: number` |
| `struct` | `name: string` (struct name from `structs`) | — |
| `code` | — | `lang: string[]` (whitelist) |
| `number` | — | `min: number`, `max: number`, `integer: boolean` |
| `boolean` | — | — |

#### 4.5.1 `richtext` value discriminator

The value of a `richtext` slot is determined by JSON type:

- A JSON **string** is interpreted as Markdown (CommonMark + GFM) regardless of the `SlotDef.format` declaration. A schema declaring `format: "portable-text"` and receiving a string value is INVALID.
- A JSON **object** is interpreted as Portable Text. The object MUST have the shape `{ "format": "portable-text", "blocks": [ ... ] }`. Implementations MUST validate `blocks` per the Portable Text specification (out of scope for this spec; see [portabletext.org](https://portabletext.org)).

A parser MAY discriminate from the value alone (string vs. object) without consulting the `SlotDef`. Validators consult the `SlotDef` to confirm the declared format matches the actual value type.

#### 4.5.2 `list` item types

`list.of` is one of:

- `"text"`, `"richtext"`, `"asset"`, `"code"`, `"number"`, `"boolean"` — built-in scalar slot types
- `{ "kind": "ref", "refTo": "<collection>" }` — references to a collection
- `{ "kind": "struct", "name": "<structName>" }` — embedded structs

### 4.6 `collections`

REQUIRED (MAY be empty). A `Collection` MUST have:

- `schema`: `string` — struct name from `structs` (or a built-in like `"blogPost"`)

A `Collection` MAY have:

- `indexBy`: `string` — record field to sort by
- `urlPattern`: `string` — pattern for record URLs (e.g. `"/blog/{slug}"`); omitted means records are embedded-only
- `layout`: `"single-file" \| "records-on-path"` — preferred file layout. Implementations MUST accept both regardless of declared preference.

### 4.7 `structs` (OPTIONAL)

Reusable shape definitions referenced from `slots[].of` (lists), `slots[].name` (struct slots), and `collections[].schema`. Same shape as `BlockType.slots`.

### 4.8 `i18n` (OPTIONAL)

```
{
  "defaultLocale": "en",                          // REQUIRED
  "locales": ["en", "fr", "es"],                  // REQUIRED, includes defaultLocale
  "routing": "prefix" | "subdomain" | "domain",   // REQUIRED
  "fallback": "default" | "404"                   // REQUIRED — applies to page-level only
}
```

A slot declared `translatable: true` carries a per-locale value map: `{ "<locale>": <value>, ... }`.

- If the requested locale L has a value, use it.
- If L is missing AND the default locale has a value, fall back to the default-locale value.
- If neither L nor the default locale has a value, the slot is treated as **empty** for validation purposes (§6).
- Readers MUST emit a warning for any per-locale fall-through.

Page-level fallback (governed by `i18n.fallback`):

- A reader receives a URL implying locale L for a page that exists only in the default locale.
- `fallback: "default"` → renderer SHOULD serve the default-locale page at the requested URL. The HTML lang attribute MUST reflect the actually-served locale.
- `fallback: "404"` → renderer MUST return a 404-equivalent. Renderers MUST NOT silently substitute.

---

## 5. Page records

A page record at `content/pages/<slug>.json`:

```
{
  "title": "string",                              // REQUIRED
  "slug": "string",                               // REQUIRED, MUST start with "/" and match filesystem position
  "status": "draft" | "published",                // REQUIRED
  "sections": [<SectionInstance>, ...],           // REQUIRED (MAY be empty)

  "publishedAt": "YYYY-MM-DD",                    // OPTIONAL — original publish date (editorial)
  "author": { "name": "...", "handle": "..." },   // OPTIONAL
  "seo": { "title": "...", "description": "...", "ogImage": "asset:..." },  // OPTIONAL
  "tokenOverrides": { ... }                       // OPTIONAL — see §4.2a
}
```

Unknown fields MUST be preserved by Level 2 writers (§9.3).

### 5.1 `SectionInstance`

```
{
  "id": "string",                                 // REQUIRED, unique within page
  "blockType": "string",                          // REQUIRED, MUST be declared in mosaic.json
  "variant": "string",                            // OPTIONAL; if present, MUST be in blockType.variants
  "state": "draft" | "published",                 // OPTIONAL, default "published"
  "slots": { "<slotName>": <value>, ... },        // REQUIRED
  "tokenOverrides": { ... }                       // OPTIONAL — see §4.2a
}
```

The `id` MUST be stable across edits. Renderers SHOULD use it as an HTML id or anchor.

#### 5.1.1 Draft sections in published pages

When a published page contains a section with `state: "draft"`:

- The draft section MUST be excluded from the rendered output for non-editor consumers.
- The draft section IS preserved in storage and visible to editors.

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

- A warnings channel (CLI, log, API field). MUST be machine-readable.
- Optional refusal to render (configurable strictness). Implementations MAY refuse; if they MAY, they MUST document the strictness flag.

### 6.1 Silent skip — consumer capability declaration

Headless consumers (custom renderers, mobile apps, AI summarisers, search indexers, RSS feed builders) are partial views of a Mosaic document and typically implement only a subset of canonical block types. For these consumers, a `<missing template>` placeholder is the wrong default.

A consumer MAY declare a **supported block types set**. Such a consumer:

- MUST silently drop sections whose `blockType` is not in its supported set from the render output.
- MUST NOT emit a `<missing template>` placeholder for dropped sections.
- MUST NOT raise a validation warning for the unsupported `blockType` itself.
- MUST NOT run §6 validation on dropped sections (skip happens BEFORE validation).
- SHOULD apply §6 validation for supported sections.
- SHOULD preserve unsupported sections in any pass-through serialisation (Level 2 round-trip) so that other consumers still see them. Silent skip applies to rendering, not to storage.

The canonical pattern is a `SKIP_BLOCKS` set consulted before rendering each section. `mosaic.json` MUST NOT declare per-consumer skip rules.

This contract is OPTIONAL for engine-default renderers, which SHOULD continue to surface unknown blocks per §6.

### 6.2 "Empty" semantics

A slot is **empty** when:

| Type | Empty if |
| --- | --- |
| `text` / `richtext` / `code` | Value is `null`, missing, or empty string |
| `asset` / `ref` | Value is `null` or missing |
| `list` | Value is `null`, missing, or `[]` |
| `struct` | Value is `null` or missing. `{}` is NOT empty — it's a struct with all fields absent (validate fields individually). |
| `number` | Value is `null` or missing. `0` is NOT empty. |
| `boolean` | Value is `null` or missing. `false` is NOT empty. |

A `required: true` slot that is empty per the above table fails validation.

---

## 7. Reference resolution

Two reference shapes appear inside slot values. The full grammar, normalisation rules, and case-sensitivity behavior are in **Appendix C**. Resolution is recursive: values inside arrays and objects MUST be walked.

### 7.1 `asset:<path>`

`asset:images/hero.jpg` resolves to:

```
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

```
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

```
{ "kind": "ref-missing", "ref": "ref:blog/a-site-is-a-document" }
```

The `<id>` portion is the record's filename basename (without `.json`) or its key in the single-file layout. It is NOT the same as a record's `slug` field (slugs MAY differ from ids; only `id` is the resolver key).

### 7.3 Markdown body assets

The reference `asset:content/<path>.md` is **syntactically** a §7.1 `asset-ref`. Behaviorally, when a `.md` extension is detected on a resolved asset, readers SHOULD inline the body as CommonMark + GFM.

### 7.4 Circular references

If A.slot refs B, and B.slot refs A: the resolver MUST detect the cycle and return one ref as `kind: "record"` with full data, the other as `kind: "ref-cycle"` with just `{ kind, ref }`. MUST NOT infinite-loop.

### 7.5 Unknown reference shapes

If a reader encounters a ref string matching no known shape, it MUST return `{ "kind": "ref-unknown", "ref": "<original-string>" }` and emit a warning. Level 2 writers MUST preserve unknown ref strings unchanged on round-trip. This allows engines to introduce engine-specific ref shapes (e.g. content-addressed block references) without breaking portability.

---

## 8. Asset manifest

`assets/manifest.json`:

```
{
  "version": 1,
  "updated": "ISO timestamp",
  "paths": { "<relative-path-under-assets/>": "sha256-<hash>" }
}
```

If `assets/` exists, `manifest.json` MUST exist. A site with `assets/` and no `manifest.json` is INVALID; Level 1 readers MUST surface this as a validation error.

The sha256 values are computed over the **raw bytes** of the asset file. Format: `"sha256-<lowercase 64-hex>"`. Manifest claims that don't match actual bytes MUST surface as warnings.

If an `asset:` ref's path is not in the manifest, the resolver MUST emit a warning AND attempt resolution relative to the assets directory. If the file exists on disk but not in the manifest, the resolver returns `sha256: null` and proceeds.

Sha256 is informational: it enables dedup and survives renames. Implementations MUST trust the path as primary; sha256 is for verification.

---

## 9. Versioning and migration

### 9.1 Spec versioning

Mosaic version (this spec) is independent of `mosaic.json#meta.schemaVersion`.

- Spec versions `0.x` — breaking changes possible between minor versions
- Spec versions `1.0` and later — semver semantics

A site's `schemaVersion` MUST bump on:

- Adding or removing a `blockType`
- Changing a `SlotDef` type or `required` flag
- Renaming variants
- Token group additions/removals (token VALUE changes do NOT bump)

### 9.2 Forward and backward compatibility

A site declares its target spec version via `mosaic.json#meta.mosaicVersion`. Readers compare this against their supported spec version:

- **Same major, same or lower minor** (e.g. reader supports `0.5`, site declares `0.4` or `0.5`): Reader MUST process normally.
- **Same major, higher minor** (reader supports `0.5`, site declares `0.6`): Reader MUST attempt to process. Unknown fields anywhere MUST be preserved (Level 2) and ignored for behavior. Reader SHOULD emit a warning naming the version gap.
- **Different major** (reader supports `0.x`, site declares `1.x`, or vice versa): Reader MAY refuse to process. If it processes, it MUST emit a warning. Readers MUST NOT silently downgrade behavior.

### 9.3 Unknown field preservation (universal rule)

Unknown fields anywhere in a Mosaic document — `mosaic.json`, page records, section instances, slot values, struct values, manifest, etc. — MUST be preserved by Level 2 writers on round-trip. This is the universal forward-compat guarantee.

---

## 10. Open questions for v0.6+

The following are intentionally deferred from v0.5. v0.5 ships without them.

- **Layouts** — named responsive grid layouts with breakpoints and area assignment. Deferred until there is real authoring experience to validate the surface.
- **Globals** — site-wide singletons (headers, footers, banners) with position vocabulary and per-page overrides. Deferred for the same reason.
- **Overlays** — off-flow page elements (modals, lightboxes, popups). Deferred.
- **Freeform block** — canonical block type for design-heavy positioned content. Deferred.
- **Canonical hashing** — `publishedHash` on section instances, JCS canonicalisation, hash-based integrity checks. Deferred. Engines that need integrity checks MAY implement them as engine-internal extensions.
- **Content-addressed block storage** — `block:sha256-<hash>` ref shape and `BlockContent` envelope. Deferred. Engines that need content-addressed storage MAY implement it as an engine-internal extension; such refs MUST appear as `ref-unknown` to other readers (§7.5).
- **Live editing / concurrency** — merge semantics for concurrent edits. Engine-defined for now.
- **Translation key serialization** — translatable slot path conventions for nested structs.
- **Asset access controls** — per-asset auth / visibility scopes.
- **Plugin / extension blocks** — third-party block types: sandboxing, identifier namespacing.
- **Portable Text full adoption** — what subset of Portable Text marks/styles a Level 1 reader MUST support.
- **Pre-bundled block library** — a canonical "starter" set of block types (hero, columns, gallery, etc.) shipped as a separate normative document.
- **Mosaic over the wire** — JSON-RPC / GraphQL / HTTP contract for fetching Mosaic content remotely.

Each of these will land via the MIP process (see CONTRIBUTING.md) when there is evidence of need from at least one implementation.

---

## Appendix A — Example sites

The [examples directory](examples/) includes:

- `examples/minimal-site/` — smallest valid Mosaic document
- `examples/blog-site/` — blog collection demonstrating `ref:` resolution and markdown body assets

Examples are document-only: a valid `mosaic.json` plus content tree. Rendering is the reader's job.

---

## Appendix B — Change log

- **v0.5 (2026-05-11)** — stripped portable-format release. Drops from v0.3-proposal: layouts (§4.6a), globals (§9), overlays (§10), freeform block (§10b), outer/inner pattern (§10a), canonical hashing (§12), concurrent-edit merge semantics (§13), block content storage (§14). Carries forward: terminology, conformance levels (now L1+L2 only), file tree, mosaic.json shape, tokenOverrides cascade, page records, validation, silent skip, reference resolution (asset + ref only), asset manifest, versioning, unknown-field preservation, reference grammar (Appendix C). Removes Level 3 conformance and all CRDT-related text. Earlier drafts (v0.1, v0.2-draft, v0.3-proposal) are preserved in git history rather than in an archive directory.
- **v0.3 (proposed, never adopted)** — full revision proposed in response to v0.2-draft peer review. Superseded by v0.5.
- **v0.2 (2026-05-11, draft — superseded)** — additive: LayoutSpec body, tokenOverrides cascade, freeform block, silent skip, outer/inner pattern.
- **v0.1 (2026-05-10)** — first published spec.

---

## Appendix C — Reference string grammar

This appendix is **normative**. It defines the syntactic shape, character classes, and normalisation rules for the reference shapes resolved in §7.

### C.1 Grammar (ABNF)

ABNF per [RFC 5234](https://www.rfc-editor.org/rfc/rfc5234).

```
ref-string      = asset-ref / record-ref

asset-ref       = "asset:" asset-path
record-ref      = "ref:" collection "/" record-id

asset-path      = path-segment *( "/" path-segment )
path-segment    = 1*( ALPHA / DIGIT / "_" / "-" / "." )

collection      = 1*( ALPHA / DIGIT / "_" / "-" )
record-id       = 1*( ALPHA / DIGIT / "_" / "-" / "." )
```

Ref strings matching none of these shapes are handled by §7.5 (unknown reference shapes). Engines MAY introduce additional ref shapes; such shapes MUST be preserved by Level 2 writers and MUST appear as `ref-unknown` to readers that don't implement them.

### C.2 Markdown body assets (§7.3)

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
```

Invalid:

```
asset:images//hero.jpg               ; empty segment
asset:images/                        ; trailing slash
asset:../etc/passwd                  ; ".." traversal
asset:images/hero with space.jpg     ; internal whitespace
ref:blog/2026-05-09/hello            ; "/" in record-id
```

---

## Appendix D — JSON Schema for `mosaic.json`

A formal JSON Schema 2020-12 document for `mosaic.json` MAY be shipped at `mosaic.schema.json` in the repo root. v0.5 does NOT ship one; producing it is a candidate for a future MIP.

If shipped, the JSON Schema covers static shape only. Runtime semantics (e.g. "every `blockType` referenced in a section MUST be declared") still live in this spec text and are not encodable in JSON Schema.

Conformance: implementations MAY validate `mosaic.json` against a static schema as a fast-path. Implementations MUST still perform spec-text validation per §6 because any such schema is a subset.

---

## Appendix E — Recommended token groups (non-normative)

Sites are not required to use any specific token group names. The following are recommended by convention so that block types written for one Mosaic site can be ported to another with minimal token re-mapping:

`color` · `font` · `size` · `space` · `radius` · `shadow` · `leading` · `tracking` · `weight` · `duration` · `ease`

Block libraries that target portability across sites SHOULD use these group names.

---

## Appendix F — Decision log (v0.5)

What was cut from v0.3-proposal and why. Listed so you can revisit any single one via the MIP process (see CONTRIBUTING.md).

| ID | Decision | Reasoning |
| --- | --- | --- |
| **D-1** | Drop Level 3 conformance and all concurrent-edit merge semantics from v0.5. | A document format spec defines what valid documents look like on disk, not how engines merge concurrent edits. Live editing is engine territory. Engines that support it claim L2 conformance from Mosaic's perspective. |
| **D-2** | Drop canonical hashing (§12 in v0.3-proposal), `publishedHash`, JCS canonicalisation. | Useful for engines that need content-addressed storage or integrity checks; not required for the portable surface. Engines MAY implement as internal extensions. |
| **D-3** | Drop content-addressed block storage (§14 in v0.3-proposal) and the `block:sha256-<hash>` ref shape. | Same as D-2. The §7.5 unknown-ref rule lets engines introduce this without breaking portability. |
| **D-4** | Drop layouts (§4.6a in v0.3-proposal). | Significant surface for a feature whose non-CSS fallback is "stack everything." Will revisit when there's real responsive-layout authoring experience to validate against. |
| **D-5** | Drop globals (§9 in v0.3-proposal). | Cross-page injection with position vocabulary and per-page overrides is a feature, not a format primitive. Defer until at least one implementation has shipped and stress-tested it. |
| **D-6** | Drop overlays (§10 in v0.3-proposal). | Same as D-5. |
| **D-7** | Drop freeform block (§10b in v0.3-proposal). | Most authoring-heavy feature in the v0.3-proposal, least implementer experience. Authors who need free positioning today can declare a custom block type and live with reduced portability. |
| **D-8** | Drop the outer/inner render pattern (§10a in v0.3-proposal). | Render guidance, not format. Belongs in implementation notes or a separate "renderer recipes" doc. |
| **D-9** | Simplify i18n fallback to two layers (slot + page) instead of three (slot + page + record). | Per-locale record subdirectories are rare in practice. Inline-translated records via translatable slots cover the common case. Record-level fallback can return if it earns the spec budget later. |
| **D-10** | Drop `publishedVersion` and `sectionLayout` from page records. | `publishedVersion` is engine state; `sectionLayout` depends on layouts (D-4). |
| **D-11** | Drop `snapshots/` and `blocks/` from the documented file tree. | Engine-internal directories. The spec acknowledges engines MAY add them but doesn't standardize them. |
| **D-12** | Keep tokenOverrides cascade. | Small, useful, no significant implementation cost. The kind of feature that's easier to lock in early than retrofit. |
| **D-13** | Keep silent skip (§6.1). | Load-bearing for headless consumers. Without it, every reader has to implement every block type. |
| **D-14** | Keep unknown-field preservation as a universal rule (§9.3). | Without this, no forward compatibility is possible. |
| **D-15** | Keep the reference grammar appendix. | The single most-cited part of the v0.3 proposal in the peer review. Ref strings are the spec's wire format; they need to be specified exactly. |

---

*End of v0.5. Read Appendix F first for what got cut.*
