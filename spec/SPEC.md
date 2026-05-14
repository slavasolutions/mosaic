# Mosaic Specification

**Version:** 0.7 (draft)
**Status:** Stabilizing toward 1.0

---

## 1. Introduction

Mosaic is a folder layout for web content. A site is a directory tree. The filesystem is the source of truth. Engines, frameworks, and agents consume that tree by following the rules in this document.

Mosaic is framework-agnostic. It says nothing about how a site is rendered, served, hosted, or stored at runtime. It only says what a valid site looks like on disk and how to resolve the addresses inside it.

### 1.1 Conformance

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used in the sense of RFC 2119.

A *conforming site* is a directory that satisfies the structural and content rules in sections 2 through 7.

A *conforming engine* is any tool that reads a conforming site, produces an index conforming to section 8, and resolves refs per section 6.

---

## 2. Top-level layout

A Mosaic site is a directory containing the following children. All are required unless marked optional.

```
<site-root>/
  mosaic.json         site schema and config (required)
  pages/              routed pages (required, may be empty)
  collections/        collection definitions (required, may be empty)
  globals/            singleton records (required, may be empty)
  images/             binary assets (optional)
```

Any other top-level files or directories are ignored by conforming engines. Authors MAY use them for tooling, source control, build output, etc.

### 2.1 The `mosaic.json` file

`mosaic.json` is the schema and minimal site config. It defines:

- Types used by records (fields, validations, references)
- Site-level settings (name, default locale, build hints)

`mosaic.json` is hand-authored. It is the contract that content conforms to. It MUST NOT contain a route table, a content listing, or any derived data.

The full schema for `mosaic.json` is given in section 9.

### 2.2 The `pages/` directory

Each file or folder directly under `pages/` (or transitively, see section 3.2) becomes a routed page. The path from `pages/` to the page determines its URL.

### 2.3 The `collections/` directory

Each immediate child directory of `collections/` is a collection. The directory name is the collection's name. Files inside are records of that collection.

Collections are not routed by themselves. A page in `pages/` routes a collection's records by declaring a `collection-list` section (section 5).

### 2.4 The `globals/` directory

Each file directly under `globals/` is a singleton record, addressable by its filename stem. Globals are not routed. They are referenced by name from anywhere.

### 2.5 The `images/` directory

Binary assets live under `images/`. A manifest at `images/manifest.json` MAY record metadata for each asset (dimensions, alt text, etc.). Assets are addressed via `asset:` refs (section 6).

---

## 3. Records and shapes

A *record* is one unit of content. Pages, collection items, and globals are all records.

### 3.1 Record content rule

A record consists of zero or one markdown file and zero or one JSON file. At least one MUST exist.

This produces three valid combinations:

| Markdown | JSON | Use case                              |
|----------|------|---------------------------------------|
| yes      | no   | Prose-only records                    |
| no       | yes  | Data-only records                     |
| yes      | yes  | Prose with structured fields          |

### 3.2 Record location

A record exists in one of two locations:

- **Direct.** A `.md` file, a `.json` file, or a matching pair (`<slug>.md` + `<slug>.json`) directly inside its parent directory. The filename stem is the slug.
- **Folder.** A directory whose name is the slug, containing `index.md`, `index.json`, or both. The folder MAY also contain co-located assets and additional files referenced by relative refs.

Authors MAY choose location per record. A single collection MAY mix direct and folder records freely.

### 3.3 Precedence between markdown and JSON

When both files exist in a record:

- Structured fields come from JSON.
- Prose body comes from markdown.
- A field named `title` follows precedence: JSON > markdown H1 > filename slug (title-cased).
- No other fields are read from markdown. Frontmatter (YAML, TOML, or otherwise) is forbidden; conforming engines MUST NOT parse markdown frontmatter.

### 3.4 Slug rules

Slugs MUST match the regex `^[a-z0-9][a-z0-9-]*$`.

Filename matching is case-sensitive on disk; engines MUST treat slugs as case-insensitive for lookup and route minting. Two records whose slugs differ only in case are a conflict and MUST be reported as a structural error (section 7.4).

### 3.5 Reserved names

Engines MUST ignore:

- Files and directories whose name begins with `.` or `_`
- The literal name `manifest.json` inside `images/`
- The literal name `index.md` and `index.json` outside a folder-shape record

---

## 4. Routing

### 4.1 Page routes

A page at `pages/<path>` is routed at URL `/<path>`, with these transformations:

- Trailing `/index.md` or `/index.json` is stripped.
- A `.md` or `.json` extension is stripped.
- `pages/index.{md,json}` routes to `/`.

Examples:

| File                                | URL                  |
|-------------------------------------|----------------------|
| `pages/index.json`                  | `/`                  |
| `pages/about.md`                    | `/about`             |
| `pages/services.json`               | `/services`          |
| `pages/annual-report-2024/index.json` | `/annual-report-2024` |

### 4.2 Collection routes

Collections are routed by pages, not by themselves. A page declares routing by including a `collection-list` section in its JSON:

```json
{
  "type": "collection-list",
  "from": "collections/news",
  "sort": "date desc",
  "limit": 20
}
```

The page MUST list the records in the collection. By default, it also mints a route per record.

The default URL pattern for minted routes is `<page-url>/{slug}`. Authors MAY override with an explicit `urlPattern` field:

```json
{
  "type": "collection-list",
  "from": "collections/news",
  "urlPattern": "/journal/{slug}"
}
```

`{slug}` is the only required substitution variable. Engines MAY support additional variables (`{year}`, `{date}`, etc.) but those are non-normative in v0.7.

A `collection-list` section MAY opt out of minting detail routes by setting `"routes": false`:

```json
{ "type": "collection-list", "from": "collections/news", "limit": 3, "routes": false }
```

This is useful when a page (e.g. a homepage) wants to display records from a collection without claiming responsibility for their detail URLs. Another page is expected to mount the collection with routing enabled.

### 4.3 Multiple mounts

The same collection MAY be mounted by multiple pages with different sorts, limits, filters, or URL patterns. Each mount is independent.

If two routing mounts produce the same URL for different records, or different URLs for the same record, that is a route collision (section 7.4). Mounts with `"routes": false` do not participate in collision checks.

If multiple routing mounts produce identical URLs for the same record (same pattern, same collection), engines MUST mint the route once. This is not a collision.

### 4.4 Unrouted collections

A collection MAY exist without any page mounting it. Its records are addressable by ref but have no URL. Engines MUST NOT mint a URL for such records.

---

## 5. Page sections

A page's JSON MAY include a `sections` array. Each section is an object with a `type` field. The spec defines one section type with normative behavior:

### 5.1 `collection-list`

Routes a collection and renders a list of its records on the page.

| Field         | Type    | Required | Description                          |
|---------------|---------|----------|--------------------------------------|
| `type`        | string  | yes      | Literal `"collection-list"`          |
| `from`        | string  | yes      | Path to collection (e.g. `collections/news`) |
| `sort`        | string  | no       | `<field> <asc\|desc>` (default `date desc` if `date` exists, else filesystem order) |
| `limit`       | integer | no       | Max records to list                  |
| `filter`      | object  | no       | Field-equality filter (non-normative) |
| `urlPattern`  | string  | no       | URL template; default `<page-url>/{slug}` |
| `routes`      | boolean | no       | If `false`, list without minting detail routes; default `true` |

All other section types are engine-defined. Engines MUST preserve unknown section types verbatim in the index so other consumers can interpret them.

---

## 6. References

A *ref* is a string that points to another piece of content. Refs have one of four forms.

### 6.1 Ref grammar

```
ref         = ref-token | asset-token | relative-token
ref-token   = "ref:" address [ "@" selector ]
asset-token = "asset:" path
relative-token = "./" path [ "@" selector ]
address     = ( "globals/" name ) | ( collection "/" slug )
selector    = JSON path | markdown heading slug
```

### 6.2 `ref:` — record references

`ref:<address>` resolves to a record.

- `ref:globals/site` → `globals/site.json`
- `ref:team/anna` → the record at slug `anna` in collection `team`, whatever its shape
- `ref:news/2025-03-12-launch` → that news item

Engines MUST resolve refs shape-agnostically. The caller does not know or care whether the target is a direct file, a sidecar pair, or a folder.

### 6.3 `asset:` — asset references

`asset:images/<path>` resolves to a binary asset under `images/`. Engines MUST look up the asset's metadata in `images/manifest.json` if present.

### 6.4 `./` — relative references

`./<path>` is resolved relative to the JSON file that contains it. Only valid inside a record's JSON. Used to point at co-located files in folder-shape or sidecar records.

- Inside `collections/news/2025-05-15-recap/index.json`, `"./hero.jpg"` resolves to `collections/news/2025-05-15-recap/hero.jpg`.

Relative refs in markdown-only records have no defined "here" — engines MUST report them as errors.

### 6.5 Selectors

A ref MAY include an `@selector` to address a part of the resolved record.

- For JSON targets: selector is a dot-path into the resolved JSON. `ref:globals/site@contact.email` resolves to the value at `contact.email`.
- For markdown targets: selector is a heading slug (lowercase, spaces → hyphens, punctuation stripped). `ref:news/launch@our-mission` resolves to the section under that heading, up to but not including the next heading at the same or higher level.
- For records with both JSON and markdown: JSON path takes precedence. If the selector matches no JSON path, engines fall back to markdown heading lookup. If neither matches, the ref is unresolved (drift error per section 7).

Selectors MAY appear on `ref:` and `./` forms. They MUST NOT appear on `asset:` forms (assets are opaque).

### 6.6 Ref expansion in the index

Refs are not eagerly inlined. When an engine produces the index (section 8), each ref MUST be represented as a stub:

```json
{
  "$ref": "team/anna",
  "url": "/team/anna",
  "title": "Anna Kovalenko"
}
```

| Field    | Type        | Description                                             |
|----------|-------------|---------------------------------------------------------|
| `$ref`   | string      | The original address (without scheme prefix)            |
| `url`    | string/null | The routed URL, or `null` if the target is unrouted     |
| `title`  | string      | The resolved title of the target                        |

Engines MAY offer explicit dereference operations on top of the index, but stubs are the normative wire format. This prevents infinite expansion on circular refs and keeps payloads predictable.

For refs with selectors, the stub gains a `selector` field:

```json
{ "$ref": "globals/site", "url": null, "title": "Site config", "selector": "contact.email" }
```

### 6.7 Circular references

Mosaic permits circular references between records. Because refs are emitted as stubs (section 6.6), engines never expand a graph far enough to encounter a cycle. Authors do not need to avoid circular refs.

---

## 7. Validation

A conforming engine MUST classify problems into three severity levels.

### 7.1 Structural errors

The site cannot be built. Examples:

- `mosaic.json` is missing or malformed
- A record has neither markdown nor JSON
- A slug violates 3.4
- Two records would route to the same URL
- A page declares a `collection-list` against a non-existent collection
- A relative ref appears in a markdown-only record

Engines MUST refuse to produce an index when structural errors are present.

### 7.2 Drift

The site can be built but is internally inconsistent. Examples:

- A field is required by the schema but missing from a record
- A ref points to a non-existent target
- A record contains fields not declared in the schema
- A selector path does not resolve in the target

Engines MUST produce an index when only drift is present, but MUST report drift to the caller.

### 7.3 Warnings

Stylistic or non-critical observations. Examples:

- A record has both a markdown H1 and a JSON `title` (JSON wins, H1 is dead text)
- An asset is in `images/` but referenced nowhere
- A collection has no mounting page and no inbound refs

### 7.4 Conflict reporting

Errors and drift MUST be reported with: severity, source file, line/column if applicable, and a stable error code (e.g. `mosaic.slug.invalid`, `mosaic.ref.unresolved`). Conforming tools rely on codes; messages are informational.

---

## 8. The index

A conforming engine produces an *index*: a derived data structure that lets consumers look up any addressable thing in O(1). The index is regenerated from sources; it is never canonical.

Storage is implementation-defined. The shape is normative:

```json
{
  "mosaic_version": "0.7",
  "site": { /* contents of mosaic.json's site field */ },
  "pages": {
    "<url>": { "shape": "...", "files": {...}, "data": {...}, "body": "...", "sections": [...] }
  },
  "collections": {
    "<name>": {
      "schema": "<type-name>",
      "records": {
        "<slug>": { "shape": "...", "files": {...}, "data": {...}, "body": "...", "url": "<url-or-null>" }
      }
    }
  },
  "globals": {
    "<name>": { "shape": "...", "files": {...}, "data": {...}, "body": "..." }
  },
  "assets": {
    "<path>": { "width": 0, "height": 0, "alt": "", "mime": "..." }
  },
  "routes": {
    "<url>": { "kind": "page" | "record", "target": "..." }
  },
  "diagnostics": [
    { "severity": "structural"|"drift"|"warning", "code": "...", "message": "...", "source": "..." }
  ]
}
```

Engines MAY add fields. Consumers MUST tolerate unknown fields.

### 8.1 Building the index

The canonical resolution algorithm:

1. Load `mosaic.json`. Validate schema syntax.
2. Index assets from `images/`. Read `images/manifest.json` if present.
3. Index globals. Each file or folder under `globals/` becomes one entry.
4. Index collections. For each subdirectory of `collections/`, enumerate records and detect shape.
5. Index pages. For each entry under `pages/`, detect shape and compute URL per 4.1.
6. Build the route table. For each page, scan sections for `collection-list` entries; expand `urlPattern` against the referenced collection.
7. Validate refs. Walk every ref in every record and confirm it resolves.
8. Emit the index.

Steps 1–6 produce structure. Step 7 produces diagnostics. Step 8 serializes.

---

## 9. The `mosaic.json` schema

```json
{
  "$schema": "https://mosaic.dev/schemas/0.7.json",
  "version": "0.7",
  "site": {
    "name": "string",
    "locale": "string (BCP 47, optional)",
    "url": "string (canonical URL, optional)"
  },
  "types": {
    "<type-name>": {
      "fields": {
        "<field-name>": {
          "type": "string" | "number" | "boolean" | "date" | "markdown" | "ref" | "asset" | "array" | "object",
          "required": true,
          "of": "<type-or-collection-name>",
          "description": "string (optional)"
        }
      }
    }
  },
  "collections": {
    "<collection-name>": { "type": "<type-name>" }
  },
  "globals": {
    "<global-name>": { "type": "<type-name>" }
  }
}
```

The `types` map defines reusable shapes. `collections` and `globals` bind a content location to a type. Pages do not declare types in v0.7; engines validate them against an implicit `Page` type that accepts arbitrary sections.

---

## 10. Versioning

Mosaic follows semantic versioning at the **spec** level. The current minor (`0.7`) is permitted to break against `0.6`. Once `1.0` ships, breaking changes require a new major version.

`mosaic.json` MUST declare its `version` field. Engines MAY refuse to read sites whose version they do not support.

---

## 11. Out of scope

The following are deliberately not in the base spec:

- Authentication, authorization, access control
- Localization beyond the locale field
- Drafts, revisions, workflow states
- Hosting, deployment, CDN configuration
- Redirects (may be addressed in a future MIP)
- Search indexes
- Editor UI, preview, live reload

These are engine, host, or tooling concerns. Mosaic describes content, not delivery.
