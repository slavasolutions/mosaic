# Mosaic Specification

**Version:** 0.8
**Status:** Stabilizing toward 1.0
**Foundations:** [`TRUTHS.md`](../TRUTHS.md)

---

## 0. About this spec

Mosaic is a folder layout for web content. A site is a directory tree. The filesystem is the source of truth. Engines, frameworks, agents, and humans read that tree by following the rules here.

Mosaic says nothing about how a site is rendered, served, hosted, or stored at runtime. It only says what a valid site looks like on disk and how to resolve the addresses inside it.

Every normative rule in this document derives from one of the seventeen truths in [`TRUTHS.md`](../TRUTHS.md). Reading the truths first is the fastest way to understand the spec.

### 0.1 Conformance language

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used in the sense of RFC 2119.

A *conforming site* is a directory that satisfies §2–§7.
A *conforming engine* is a tool that reads a conforming site, produces an index conforming to §8, and resolves refs per §6.

### 0.2 Engine namespaces

Engine-specific extensions use **two** namespacing conventions, depending on what's being named.

**Field names** in any JSON (records, manifest, sections, asset manifests) → prefix with `$`. Examples: `$clearcms.translations`, `$astro.localized`, `$mosaic.inferred`.

- Mosaic field validation (`mosaic.field.unknown`) skips any field whose name starts with `$`.
- The `$` namespace is reserved for engine extensions; Mosaic itself uses bare field names for normative fields, plus `$ref`, `$asset`, `$rel`, `$value`, `$type` as specifically defined in this spec.
- This rule applies at every JSON nesting level.

**Diagnostic codes** → bare dot prefix. Examples: `clearcms.engine.warning`, `astro.template.skipped`. Mosaic-defined codes are all `mosaic.*` and listed in §6.

### 0.3 Native and embedded engines

A conforming engine MAY:

- Use the produced route table directly to serve URLs (**native operation**).
- Treat the index purely as a queryable content store and let a host framework own routing (**embedded operation**).

The folder layout, ref grammar, and resolution rules are identical in both modes. The route table is always produced; whether an engine acts on it is implementation-defined. Embedded engines plug Mosaic content into Astro, Next, SvelteKit, Remix, etc.

---

## 1. Folder layout

A Mosaic site is a directory containing the following structure. Items marked OPTIONAL may be omitted.

```
my-site/
  mosaic.json         the manifest (required)
  pages/              routed pages (required, may be empty)
  collections/        collection definitions (required, may be empty)
  images/             binary assets (optional)
  <singleton>.json    singleton records, at the root (zero or more)
  <singleton>.md
```

Any other top-level files or directories are ignored by conforming engines. Authors MAY use them for tooling, source control, build output, etc.

### 1.1 `mosaic.json` — the manifest

`mosaic.json` declares what the site **should be**: identity, types, collections (with defaults), singletons, redirects, and design tokens. The folder is what the site **currently is**.

`mosaic.json` is hand-authored. It MUST NOT contain a route table, a content listing, or any derived data. Full schema in §9.

### 1.2 `pages/`

Each file or folder under `pages/` becomes a routed page. The path from `pages/` to the page determines its URL. See §3.

### 1.3 `collections/`

Each immediate child directory of `collections/` is a collection. The directory name is the collection's name. Files inside are records of that collection.

Collections are not routed by themselves. A page in `pages/` routes a collection's records by declaring a `collection-list` section (§4).

### 1.4 Singletons (at the root)

Each singleton declared in `mosaic.json#singletons` corresponds to one record at the **site root**: a `<name>.json` file, a `<name>.md` file, or both. Singleton records follow the same record-shape rules as collection records (§2).

Singletons are not routed. They are referenced from anywhere via `ref:<name>` (§5).

By convention, the following singletons appear in most sites:

- `site` — site-wide content (contact info, tagline, social handles)
- `header` — top-of-page navigation content
- `footer` — bottom-of-page content
- `tokens` — design tokens (§10)
- `redirects` — redirect rules (alternative to declaring inline in `mosaic.json`)

No singleton is required. Use whatever the site needs.

### 1.5 `images/`

Binary assets live under `images/`. A manifest at `images/manifest.json` MAY record metadata for each asset (dimensions, alt text, etc.). The shape of `images/manifest.json` is given in §1.6. Assets are addressed via `asset:` refs (§5.4).

### 1.6 `images/manifest.json`

If present, `images/manifest.json` is a flat object keyed by the asset's path under `images/`:

```json
{
  "logo.svg": { "width": 200, "height": 60, "alt": "Site logo", "mime": "image/svg+xml" },
  "hero.jpg": { "width": 1920, "height": 1080, "alt": "...", "mime": "image/jpeg" }
}
```

Engines MUST tolerate unknown fields per record. Authors MAY add their own (`sha256`, `caption`, etc.). Engines MUST preserve unknown fields verbatim (§7.6).

### 1.7 Reserved root names

The following names at the site root are NEVER treated as singletons, regardless of what `mosaic.json` declares:

- `mosaic.json`
- `README.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `AGENTS.md`
- `pages`, `collections`, `images`
- Any file or directory whose name begins with `.` or `_`

A singleton declared in `mosaic.json` whose name collides with this list is a structural error (`mosaic.singleton.reserved`).

---

## 2. Records and shapes

A *record* is one unit of content. Pages, collection items, and singletons are all records.

### 2.1 Record content

A record consists of zero or one markdown file and zero or one JSON file. **At least one MUST exist.**

| Markdown | JSON | Use case |
|----------|------|----------|
| yes      | no   | Prose-only records |
| no       | yes  | Data-only records |
| yes      | yes  | Prose with structured fields |

### 2.2 Record location

A record exists in one of two locations:

- **Direct.** A `.md` file, a `.json` file, or a matching pair (`<slug>.md` + `<slug>.json`) directly inside its parent directory. The filename stem is the slug.
- **Folder.** A directory whose name is the slug, containing `index.md`, `index.json`, or both. The folder MAY also contain co-located assets and additional files referenced by relative refs (§5.5).

Authors MAY choose location per record. A single collection MAY mix direct and folder records freely.

### 2.3 Title precedence and required-title

When a record needs a title, engines MUST resolve it in this order:

1. **JSON `title` field.** If present and non-empty, use it.
2. **First markdown H1.** If JSON has no `title` and the markdown body starts (after optional blank lines) with an `# H1`, use the H1 text.
3. **Filename slug, title-cased.** Fallback. `2025-launch` → "2025 Launch".

If a record's type declares `title` as `required: true`, validation MUST run against the **resolved** title. A record that has no JSON `title` but has an H1 satisfies a required-title constraint.

When both a JSON `title` and a markdown H1 exist in the same record, the JSON wins and the H1 becomes "dead text". Engines SHOULD emit a `mosaic.title.dead-h1` warning.

### 2.4 No frontmatter

Frontmatter (YAML, TOML, or otherwise) is forbidden. Conforming engines MUST NOT parse markdown frontmatter. A markdown file beginning with `---` followed by a YAML block is a structural error (`mosaic.frontmatter.present`).

### 2.5 Slug rules

Slugs MUST match `^[a-z0-9][a-z0-9-]*$`. This applies uniformly to:

- filename stems for direct records (`pages/about.md` → slug `about`)
- directory names for folder-shape records
- slug segments inside `ref:` addresses (a malformed-case slug in a ref is `mosaic.ref.malformed`, structural)

Filename matching is case-sensitive on disk. The case-insensitivity rule applies only to **detecting collisions**: two records whose slugs differ only in case (e.g. `Anna.json` + `anna.json`) are a structural conflict (`mosaic.slug.case`). Refs themselves use the lowercase form.

**Locale suffix (since 0.8.1, MIP-0014).** A filename of the form `<slug>.<locale>.{md,json}` where `<locale>` matches an entry in `mosaic.json#site.locales` (§8.2) is a per-locale variant of `<slug>.{md,json}`. The filename is parsed by stripping the extension first, then checking the trailing `.<segment>` against `site.locales`. If `<segment>` is not a known locale, the entire stem is treated as the slug and is subject to the slug grammar above. A locale suffix on a file whose tag is not in `site.locales` fires `mosaic.locale.invalid` (drift).

### 2.6 Reserved names within records

Engines MUST ignore the following anywhere inside `pages/` and `collections/`:

- Files and directories whose name begins with `.` or `_`
- The literal names `README.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `AGENTS.md`, `NOTES.md` (use for in-tree documentation; never become records)
- The literal name `manifest.json` inside `images/`

A file named `index.md` or `index.json` is the folder-shape content of its parent directory (§2.2). At the top of `pages/`, `index.{md,json}` is the home record (§3.2). The folder-shape rule always claims it; engines never "ignore" an index file.

### 2.7 Body and sections

When a record has both a markdown body and a `sections` array in its JSON:

1. The `sections` array MUST own visible rendering. The body is a default text source that sections MAY reference via `ref:` or `./` to surface its content.
2. Engines MUST NOT render the body as a separate block alongside sections.
3. To include the body inside the section flow explicitly, add a `{ "type": "prose", "from": "./<filename>.md" }` section.
4. If `sections` is absent or empty, the body is rendered directly.

### 2.8 Localized records (since 0.8.1)

Mosaic supports two orthogonal localization mechanisms, both first-class. See MIP-0014 for the full rationale.

**Translatable fields.** Any field value of the shape `{ "$type": "translatable", "values": { "<locale>": <value>, ... } }` is a per-locale map. Engines resolve to `values[activeLocale]`, fall back to `values[site.defaultLocale]`, then to any present value; missing values emit `mosaic.locale.missing` (warning).

**Locale-suffix records.** Sibling files `<slug>.<locale>.{md,json}` provide the per-locale variant of `<slug>.{md,json}`. Shared JSON applies across locales; per-locale JSON merges on top at field granularity; markdown body uses the per-locale `.md` when present, else the base. Filename grammar is amended in §2.5.

**Resolution algorithm for `<slug>` at active locale `L`:**

1. Base JSON = parsed `<slug>.json` if exists, else `{}`.
2. If `<slug>.<L>.json` exists, deep-merge it on top of base JSON (objects merge recursively; arrays replace).
3. Body = `<slug>.<L>.md` if exists, else `<slug>.md`, else none.
4. For any field still in `{ "$type": "translatable", "values": {...} }` shape, replace with `values[L]` (or `values[defaultLocale]` with `mosaic.locale.missing`).
5. Title precedence (§2.3) and required-title (MIP-0010) run against the resolved record.

A non-localized site (`site.locales` absent or single-locale) uses the algorithm with `L = defaultLocale`. Translatable fields with a single locale value resolve trivially.

---

## 3. Routing

### 3.1 Page routes

A page at `pages/<path>` is routed at URL `/<path>`. Paths may be **arbitrarily deep**; each path segment is a slug per §2.5.

Transformations:

- Trailing `/index.md` or `/index.json` is stripped.
- A `.md` or `.json` extension is stripped.
- `pages/index.{md,json}` routes to `/`.

| File | URL |
|------|-----|
| `pages/index.json` | `/` |
| `pages/about.md` | `/about` |
| `pages/services.json` | `/services` |
| `pages/annual-report-2024/index.json` | `/annual-report-2024` |
| `pages/archive/2024/winter.json` | `/archive/2024/winter` |
| `pages/about/team.md` | `/about/team` |
| `pages/about/team/index.md` | `/about/team` (folder shape) |
| `pages/about/team/history.md` | `/about/team/history` |

Every page resolves to **exactly one URL**. Shape (direct vs folder) is a storage choice, not a routing concept. A directory under `pages/` with no `index.{md,json}` and no nested page records is ignored — it isn't a record, just a URL-prefix container.

A folder shape (`pages/<dir>/index.*`) and a direct sibling at the same URL (`pages/<dir>.{md,json}`) MUST be reported as `mosaic.route.collision` (structural).

### 3.2 Home is `/`

`pages/index.{md,json}` produces the route `/`. The slug `home` at the top level of `pages/` is reserved: a file named `pages/home.md`, `pages/home.json`, or a folder `pages/home/` MUST be reported as a structural error (`mosaic.home.reserved`).

Engines MUST emit an automatic redirect from `/home` to `/` (see §3.6). This is the only redirect produced without an explicit declaration.

This prevents the common error where authors create both `pages/index` and `pages/home`, then link inconsistently from navigation.

### 3.3 Collection routes via `collection-list`

A page declares routing for a collection by including a `collection-list` section in its JSON. The section's `from` MUST be `"collections/<name>"`. Engines MUST normalize a trailing slash (if `from` ends with `/`, strip it) and emit `mosaic.collection.from-trailing-slash` (warning) for authoring feedback. After normalization, the value MUST point at an existing collection or `mosaic.collection.missing` fires (structural).

```json
{
  "type": "collection-list",
  "from": "collections/news",
  "sort": "date desc",
  "limit": 20
}
```

The page MUST list the records in the collection. By default, it also mints a route per record using the pattern `<page-url>/{slug}`. Authors MAY override with an explicit `urlPattern`:

```json
{
  "type": "collection-list",
  "from": "collections/news",
  "urlPattern": "/journal/{slug}"
}
```

`{slug}` is the only required substitution variable in 0.8. Engines MAY support additional variables (`{year}`, `{date}`, etc.) — those are non-normative.

If `mosaic.json` declares a `defaultSort` or `defaultMount` for the collection (§9.4), engines MAY use those as fallbacks when the section omits them. The fallback is non-normative: engines MAY ignore the defaults.

### 3.4 `routes: false`

A `collection-list` MAY opt out of minting detail routes:

```json
{ "type": "collection-list", "from": "collections/news", "limit": 3, "routes": false }
```

Useful when a page (typically the homepage) displays records from a collection without claiming responsibility for their detail URLs. Another page is expected to mount the collection with routing enabled.

Engines MUST NOT report a collision for a `routes: false` mount.

### 3.5 Multiple mounts

The same collection MAY be mounted by multiple pages. Each mount is independent.

- Different URLs for the same record → route collision (structural).
- Identical URLs for the same record (same pattern) → engines mint the route once. Not a collision.
- One `routes: true` mount and any number of `routes: false` mounts → never a collision.

### 3.6 Redirects

Redirects are declared in `mosaic.json#redirects` as an array:

```json
"redirects": [
  { "from": "/old-news", "to": "/news", "status": 301 },
  { "from": "/team/anna-k", "to": "/team/anna", "status": 301 }
]
```

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | Old URL path. MUST start with `/`. |
| `to` | string | yes | New URL path or absolute URL. |
| `status` | integer | no | HTTP status (301, 302, 307, 308). Default `301`. |

Engines MUST:

- Add one entry per redirect to the route table with `kind: "redirect"` (per the array shape in §7.1).
- Add the automatic `/home → /` redirect (§3.2). The auto-entry MUST appear in BOTH `index.redirects` (with `source: "auto"`, full `from`/`to`/`status`) AND `index.routes` (as a route-table entry with `kind: "redirect"`).
- Detect redirect loops (`A → B → A`, any length, including self-loops) and report as a single `mosaic.redirect.loop` per cycle.
- Detect a redirect `from` that collides with a real page or record route (i.e. an entry whose `kind` is `page` or `record`) and report as `mosaic.redirect.collision`. Redirect-redirect overlap is NOT a collision; the later rule is ignored and `mosaic.redirect.duplicate-from` (warning) is emitted.

Native engines apply redirects server-side via HTTP status responses. Embedded engines surface the redirect table to the host framework's routing layer. Wireframe renderers MAY emit `<meta http-equiv="refresh">` placeholders.

Redirects MAY also live in a `redirects` singleton at the root: `redirects.json` MUST be a JSON object with exactly one required key `rules`, whose value is an array of redirect rules of the same shape as the inline form above. A singleton with the wrong shape is `mosaic.field.type-mismatch` (drift). If both `mosaic.json#redirects` and a `redirects` singleton exist, the singleton wins, and engines SHOULD emit `mosaic.redirect.duplicate-source` warning.

### 3.7 Unrouted collections

A collection MAY exist without any page mounting it. Its records are addressable by ref but have no URL. Engines MUST NOT mint a URL for such records. The record's `url` field in the index is `null`.

---

## 4. Sections

A page's JSON MAY include a `sections` array. Each section is an object with a `type` field.

### 4.1 `prose` (normative)

Inlines a markdown record's body (or any markdown file co-located with the JSON) into the page's section flow. Lets a single record contain both a body and structured sections without duplication (per §2.7).

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | yes | Literal `"prose"` |
| `from` | string | yes | A `./`-prefixed path to a markdown file relative to the JSON containing this section. The target's body is rendered in-place. |

The `from` value MAY include an `@selector` to target a heading section (§5.6) rather than the whole body.

### 4.2 `collection-list` (normative)

The only section type with normative behavior.

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | yes | Literal `"collection-list"` |
| `from` | string | yes | Path to collection (e.g. `collections/news`) |
| `sort` | string | no | `<field> <asc\|desc>` |
| `limit` | integer | no | Max records to list |
| `filter` | object | no | Field-equality filter (non-normative) |
| `urlPattern` | string | no | URL template; default `<page-url>/{slug}` |
| `routes` | boolean | no | If `false`, list without minting detail routes; default `true` |

Default sort: if the collection's records have a `date` field, default to `date desc`. Otherwise, default to filesystem order. When the sort key produces ties, engines MUST break ties by slug ascending — this guarantees deterministic output across engines.

### 4.3 Custom sections

All other section types are engine-defined. Engines MUST preserve unknown section types verbatim in the index so other consumers can interpret them. This is a specific case of the universal preservation rule (§7.6).

---

## 5. References

A *ref* is a string that points to another piece of content. Refs have one of four forms.

### 5.1 The four forms

- `ref:<address>` — a record (singleton or collection record)
- `asset:<path>` — a binary asset under `images/`
- `./<path>` — a path relative to the JSON file containing the ref
- A `@selector` suffix on `ref:` or `./` — addresses a sub-part of the resolved record

### 5.2 ABNF grammar

```abnf
ref-string     = ref-token / asset-token / relative-token
ref-token      = "ref:" address [ "@" selector ]
asset-token    = "asset:" asset-path
relative-token = "./" rel-path [ "@" selector ]

address        = singleton-name / ( collection-name "/" slug )
singleton-name = name
collection-name= name
slug           = lower-alnum *( "-" / lower-alnum )
name           = lower-alnum *( "-" / lower-alnum )
asset-path     = path-segment *( "/" path-segment )
rel-path       = path-segment *( "/" path-segment )
path-segment   = 1*( ALPHA / DIGIT / "_" / "-" / "." )
selector       = json-path / heading-slug
lower-alnum    = "a" / "b" / ... / "z" / DIGIT
```

`json-path` and `heading-slug` are defined in §5.6. Engines MUST reject refs that fail this grammar with `mosaic.ref.malformed`.

### 5.3 Addresses split on the first `/`

For `ref:` addresses:

1. If the address contains no `/`, treat it as a singleton name. Look up `<name>.json` and/or `<name>.md` at the site root.
2. If the address contains `/`, split on the **first** `/`. The part before is a collection name, the part after is a record slug.

A singleton named `team` and a collection named `team` MAY coexist. `ref:team` resolves to the singleton; `ref:team/anna` resolves to a record. The first-`/` rule disambiguates without any reserved-name machinery.

### 5.4 `asset:` resolution

`asset:images/<path>` resolves to a binary asset under `images/`. Engines MUST look up the asset's metadata in `images/manifest.json` if present. If the manifest entry is missing but the file exists on disk, engines MUST emit `mosaic.asset.unmanifested` (warning) and continue.

### 5.5 `./` — relative references

`./<path>` is resolved relative to the JSON file containing the ref. Only valid inside a record's JSON.

Inside `collections/news/2025-05-15-recap/index.json`, `"./hero.jpg"` resolves to `collections/news/2025-05-15-recap/hero.jpg`.

Relative refs are JSON-only by construction (refs are detected as JSON string values, §5.7). A markdown-only record has no JSON channel, so the case is impossible on conforming sites. `mosaic.relative.invalid` is reserved for any future case where a relative ref appears without a defined anchor — engines should not encounter it in normal use.

### 5.6 Selectors

A ref MAY include an `@selector` to address a sub-part of the resolved record.

**JSON path selectors** target structured fields:

- Dot path: `ref:site@contact.email` → the value at `contact.email`.
- Array index: `ref:header@nav.0.label` → the `label` of the first nav item. Zero-based, integer-only.
- Nested mix: `ref:site@social.platforms.2.url`.

Each segment MUST match `[A-Za-z0-9_-]+` for object keys (object keys are case-sensitive; DTCG camelCase like `fontFamily` is valid), or be a non-negative integer for array indices.

**Markdown heading selectors** target a section of prose. The selector is the heading slug, computed as:

1. Strip leading `#` characters and one space.
2. Lowercase.
3. Replace runs of whitespace with single hyphens.
4. Strip characters not in `[a-z0-9-]`.
5. Trim leading/trailing hyphens.

Example: `## Where the name comes from` → `where-the-name-comes-from`. The selection runs from the heading line up to (but not including) the next heading at the same or higher level.

**Precedence.** For records with both JSON and markdown:

1. Try the JSON path. If it resolves, use it.
2. Otherwise, try the markdown heading. If it resolves, use it.
3. Otherwise, `mosaic.selector.unresolved` (drift).

Selectors MAY target any JSON value — scalar, object, or array. Consumers decide how to render non-scalar targets. Engines MAY emit `mosaic.selector.non-scalar` as an OPTIONAL informational warning when a selector resolves to an array or object; this is non-normative.

Selectors MAY appear on `ref:` and `./` forms. They MUST NOT appear on `asset:` forms — assets are opaque.

### 5.7 How engines detect refs

A ref is recognised by the **string prefix** of any JSON value, anywhere in a record's JSON. Specifically, engines MUST scan every string value in record JSON and treat the value as a ref if it begins with:

- `ref:`
- `asset:`
- `./`

Engines MUST NOT use the schema to decide whether a field is a ref. The schema describes shape; the value describes intent. A field declared `type: "string"` whose value happens to be `"asset:images/foo.png"` is a ref, and engines MUST resolve it.

This rule means refs work inside arbitrary section JSON, inside arrays, inside nested objects, and inside engine-specific custom sections without any registration step.

### 5.8 Stubs in the index

Refs are not eagerly inlined. When an engine produces the index (§8), each ref MUST be represented as a stub:

```json
{
  "$ref": "team/anna",
  "url": "/team/anna",
  "title": "Anna Kovalenko"
}
```

| Field | Type | Description |
|---|---|---|
| `$ref` | string | The original address (without scheme prefix) |
| `url` | string \| null | The routed URL, or `null` if the target is unrouted |
| `title` | string | The resolved title of the target (per §2.3) |

For refs with selectors, the stub gains a `selector` field:

```json
{ "$ref": "site", "url": null, "title": "Site config", "selector": "contact.email" }
```

For `asset:` refs, the stub shape is:

```json
{ "$asset": "images/hero.jpg", "alt": "...", "width": 1920, "height": 1080 }
```

For `./` (relative) refs, the stub shape mirrors `ref:` but uses `$rel` instead of `$ref`:

```json
{ "$rel": "./hero.jpg", "url": "/news/2025-05-15-recap/hero.jpg", "title": "" }
```

If a `./` path points at an asset, engines MAY use the `$asset` shape instead. If it points at a markdown section, the stub MAY carry the resolved heading content per §5.6.

Engines MAY add fields. Consumers MUST tolerate unknown fields.

### 5.9 Circular references

Mosaic permits cycles. Because refs are emitted as stubs, engines never expand a graph far enough to encounter a cycle. Authors need not avoid circular refs.

---

## 6. Validation

### 6.1 Three levels

Every diagnostic MUST be one of:

- **Structural.** The site cannot be built. Engines MUST refuse to produce an index.
- **Drift.** The site can be built but is internally inconsistent. Engines MUST produce an index AND report drift.
- **Warning.** Stylistic or non-critical. Engines produce an index. Reporting is optional but RECOMMENDED.

### 6.2 Structural errors (selected)

- `mosaic.config.invalid` — `mosaic.json` missing, unparseable, or schema-invalid
- `mosaic.config.version-unsupported` — version mismatch (engine MAY refuse)
- `mosaic.record.empty` — record has neither markdown nor JSON
- `mosaic.slug.invalid` — slug doesn't match the regex
- `mosaic.slug.case` — two records collide only by case
- `mosaic.route.collision` — two pages or routing mounts claim the same URL
- `mosaic.collection.missing` — `collection-list` references a non-existent path
- `mosaic.relative.invalid` — reserved (see §5.5); relative refs in conforming sites are JSON-only so this code does not fire in normal authoring. Engines MAY use it for non-conforming hand-edited cases.
- `mosaic.frontmatter.present` — markdown file has frontmatter
- `mosaic.home.reserved` — `pages/home.*` exists
- `mosaic.singleton.reserved` — declared singleton collides with reserved root name
- `mosaic.singleton.missing` — declared singleton has no file at the root
- `mosaic.redirect.loop` — redirects form a cycle
- `mosaic.redirect.collision` — redirect `from` collides with a real route
- `mosaic.ref.malformed` — ref string violates the grammar

### 6.3 Drift (selected)

- `mosaic.field.required` — required field missing from record (after applying title precedence per §2.3)
- `mosaic.field.unknown` — record has a field not declared in its type
- `mosaic.field.type-mismatch` — field value doesn't match declared type
- `mosaic.ref.unresolved` — `ref:` or `asset:` target doesn't exist
- `mosaic.selector.unresolved` — `@selector` doesn't resolve in the target
- `mosaic.locale.invalid` — locale-suffix file or translatable-field key uses a tag not in `site.locales` (since 0.8.1)
- `mosaic.locale.unknown-default` — `mosaic.json#site.defaultLocale` is not in `site.locales` (since 0.8.1)

### 6.4 Warnings (selected)

- `mosaic.title.dead-h1` — markdown H1 alongside JSON `title`
- `mosaic.asset.orphan` — asset in `images/` referenced nowhere
- `mosaic.asset.unmanifested` — asset on disk but not in manifest
- `mosaic.collection.unmounted` — collection has no mounting page and no inbound refs
- `mosaic.redirect.duplicate-source` — both `mosaic.json#redirects` and `redirects` singleton exist
- `mosaic.locale.missing` — translatable field has no value for the active locale (fell back to default, or no value at all) (since 0.8.1, MIP-0014)

### 6.5 Diagnostic format

Each diagnostic MUST carry:

| Field | Description |
|---|---|
| `severity` | `"structural"` \| `"drift"` \| `"warning"` |
| `code` | Stable identifier (`mosaic.xxx.yyy`) |
| `source` | File path relative to site root; or URL for route diagnostics |
| `message` | Human-readable, informational |
| `line`, `column` | Optional, where applicable |

Tools rely on `code`; `message` may change between versions. Errors with `code` outside the spec's listed codes are engine extensions and MUST be prefixed (e.g. `clearcms.something`).

### 6.6 Unknown-field preservation

Any tool that writes a Mosaic file MUST preserve unknown fields verbatim. This applies to:

- `mosaic.json` — unknown top-level keys, unknown keys inside `types`, `collections`, `singletons`
- Record JSON — unknown fields at any nesting level
- `images/manifest.json` — unknown fields per asset
- Custom sections in pages — preserved as opaque objects

This rule is the universal forward-compat guarantee. Without it, a tool from engine A silently strips fields engine B added, and round-tripping content through both engines becomes lossy.

---

## 7. The index

A conforming engine produces an *index*: a derived data structure that lets consumers look up any addressable thing in O(1). The index is regenerated from sources; it is never canonical.

Storage is implementation-defined. The shape is normative.

### 7.1 Index shape

Per-record fields:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `shape` | enum | yes | `"direct"` (single file or sidecar pair) or `"folder"` (directory with `index.*`) |
| `files` | object | yes | `{ "md": "<path>"?, "json": "<path>"? }` — paths relative to site root |
| `data` | object | when JSON present | parsed JSON content |
| `body` | string | when markdown present | raw markdown text |
| `sections` | array | optional | extracted from `data.sections` for pages |
| `url` | string \| null | yes for routed records | the spec's computed URL per §3 |
| `title` | string | yes | resolved title per §2.3 |

URL keys in `pages` and `collections.records` are the **spec's computed URLs** per §3. The `routes` field is an **array** of route entries (each with `url`, `kind`, and `target`) — ordered for deterministic iteration; engines MAY also expose a URL-keyed lookup map as an engine extension. Embedded engines that rewrite URLs (host-framework subpath mounting, locale prefixes, etc.) MUST apply the rewrite in their adapter layer, not by mutating the index. This keeps the index portable across hosts.

**Index invariants:**
- Every entry in `routes` whose `kind` is `"page"` MUST have a matching entry in `pages` at the same URL.
- Every `kind: "record"` route MUST have a matching `collections.<name>.records.<slug>` whose `url` equals the route URL.
- Every `kind: "redirect"` route MUST correspond to an entry in `redirects` (or be the auto `/home → /` entry).
- `target` semantics: for `page`/`record`, it is the index-path of the source record (e.g. `pages/about` or `collections/news/2025-launch`). For `redirect`, it is the `to` URL.

```json
{
  "mosaic_version": "0.8",
  "site": { "name": "...", "locale": "...", "url": "..." },
  "pages": {
    "<url>": { "shape": "direct" | "folder", "files": {...}, "data": {...}, "body": "...", "sections": [...], "title": "..." }
  },
  "collections": {
    "<name>": {
      "type": "<type-name>",
      "records": {
        "<slug>": { "shape": "...", "files": {...}, "data": {...}, "body": "...", "url": "<url-or-null>" }
      }
    }
  },
  "singletons": {
    "<name>": { "shape": "...", "files": {...}, "data": {...}, "body": "..." }
  },
  "assets": {
    "<path>": { "width": 0, "height": 0, "alt": "", "mime": "..." }
  },
  "tokens": { /* DTCG payload from the tokens singleton, if any */ },
  "routes": [
    { "url": "<url>", "kind": "page" | "record" | "redirect", "target": "..." }
  ],
  "redirects": [
    { "from": "/home", "to": "/", "status": 301, "source": "auto" }
  ],
  "diagnostics": [
    { "severity": "structural"|"drift"|"warning", "code": "...", "message": "...", "source": "..." }
  ]
}
```

Engines MAY add fields. Consumers MUST tolerate unknown fields.

### 7.2 Build algorithm

1. Load `mosaic.json`. Validate against the JSON schema; collect any `mosaic.config.*` diagnostics.
2. Index assets from `images/`. Read `images/manifest.json` if present.
3. Index singletons. For each entry in `mosaic.json#singletons`, locate the file(s) at the root.
4. Index collections. For each subdirectory of `collections/`, enumerate records and detect shape.
5. Index pages. For each entry under `pages/`, detect shape and compute URL per §3.1. Apply the home rule (§3.2).
6. Build the route table. For each page, scan sections for `collection-list` entries; expand `urlPattern` against the referenced collection. Add explicit redirects (§3.6). Add the automatic `/home → /` redirect. Detect collisions.
7. Walk every string value in every record's JSON. For each string matching a ref prefix (§5.7), parse, resolve, and emit a stub.
8. Emit the index.

Steps 1–6 produce structure. Step 7 produces diagnostics. Step 8 serialises.

---

## 8. The manifest schema

`mosaic.json` validates against the JSON Schema 2020-12 document at [`mosaic.schema.json`](../mosaic.schema.json) in the repo root.

### 8.1 Top-level

```json
{
  "$schema": "https://mosaic.dev/schemas/0.8.json",
  "version": "0.8",
  "site":        { "...identity..." },
  "types":       { "...": { "fields": {...} } },
  "collections": { "...": { "type": "...", "defaultSort": "...", "defaultMount": "..." } },
  "singletons":  { "...": { "type": "..." } },
  "redirects":   [ { "from": "...", "to": "...", "status": 301 } ],
  "tokens":      { /* DTCG-shaped, see §10 */ }
}
```

All top-level fields are required to be present, but each MAY be empty (`{}` or `[]`).

### 8.2 `site` — identity

```json
"site": {
  "name": "string (required)",
  "locale":        "BCP 47 tag (optional, legacy)",
  "defaultLocale": "BCP 47 tag (optional)",
  "locales":       ["<BCP 47 tag>", ...],
  "url":           "canonical URL (optional)"
}
```

This is **identity metadata**, used by tooling, indexers, deployment. Content for site-wide display (contact info, tagline, social handles) belongs in a `site` singleton at the root, not here. The two MAY have different `name` values.

**Localization fields (since 0.8.1, MIP-0014):**

- `defaultLocale` (optional) — BCP 47 tag for the locale resolved when none is requested and the fallback target for missing translations. Defaults to `locale` if present, else `"en"`.
- `locales` (optional) — all locales the site ships content for. If absent, the site is single-locale (`[defaultLocale]`). If present, `defaultLocale` MUST be a member; otherwise `mosaic.locale.unknown-default` (drift) fires.
- `locale` is preserved verbatim for round-trip safety (MIP-0009). Engines SHOULD prefer `defaultLocale` when both are present.

See §2.8 and MIP-0014 for resolution semantics.

### 8.3 `types`

A `type` declares a reusable record shape:

```json
"types": {
  "TeamMember": {
    "fields": {
      "title":      { "type": "string", "required": true },
      "role":       { "type": "string", "required": true },
      "email":      { "type": "string" },
      "photo":      { "type": "asset" },
      "colleagues": { "type": "array", "of": { "kind": "ref", "to": "team" } },
      "bio":        { "type": "markdown" }
    }
  }
}
```

Field `type` is one of: `string`, `number`, `boolean`, `date`, `markdown`, `ref`, `asset`, `array`, `object`.

For `ref`, an optional `to` field scopes the ref to a collection (or `"*"` for any). For `array`, `of` accepts either a primitive type name (`"string"`, `"number"`, ...) or an object `{ "kind": "ref", "to": "<collection>" }` for arrays of refs, or `{ "kind": "object", "fields": {...} }` for arrays of inline objects.

For `object`:
- An `object` field with declared `fields` validates its children recursively (each declared sub-field with its own type + required-ness; undeclared keys trigger `mosaic.field.unknown` drift).
- An `object` field with **no `fields`** declared is **free-form**: any sub-key/sub-value is accepted, no drift fires. This is the field-level mirror of §8.3.1's type-level escape hatch — useful when wrapping opaque blobs like a `contact` map or a `metadata` bag.

#### 8.3.1 Free-form types (escape hatch)

A type whose `fields` is `{}` (empty) is **free-form**: engines MUST NOT emit `mosaic.field.unknown` for any field on a record bound to it. This is the spec's escape hatch for opaque payloads — most notably DTCG-shaped `tokens.json` (§10), where Mosaic doesn't validate the internal structure but still wants the singleton declared so refs (`ref:tokens@…`) work.

Engine-prefixed fields (`$mosaic.*`, `$clearcms.*`, `$astro.*`, etc.) are also exempt from the unknown-field check on every record, regardless of type. They are reserved namespaces for engines (MIP-0009).

### 8.4 `collections`

```json
"collections": {
  "news": {
    "type": "NewsItem",
    "defaultSort": "date desc",
    "defaultMount": "/news"
  }
}
```

`defaultSort` and `defaultMount` are optional and non-normative for validation. They guide:

1. `mosaic init` scaffolding (creates `pages/<defaultMount-tail>.json` with a `collection-list` using `defaultSort`).
2. Engines that want to fall back when a page mounts the collection without overrides.

Engines MAY ignore the defaults entirely.

### 8.5 `singletons`

```json
"singletons": {
  "site":      { "type": "SiteConfig" },
  "header":    { "type": "Header" },
  "footer":    { "type": "Footer" },
  "tokens":    { "type": "DesignTokens" },
  "redirects": { "type": "Redirects" }
}
```

Each entry binds a singleton name to a type. The file at `<name>.json` / `<name>.md` at the site root MUST validate against the bound type.

A singleton declared but missing from disk is `mosaic.singleton.missing` (structural).

### 8.6 `redirects` (inline)

See §3.6.

### 8.7 `tokens` (inline)

See §10. Tokens declared inline in `mosaic.json` are equivalent to tokens declared in a `tokens` singleton; the singleton wins if both exist (`mosaic.tokens.duplicate-source` warning).

---

## 9. Versioning

`mosaic.json#version` declares which spec version a site targets.

- Same minor or lower (engine 0.8 reading site 0.7 or 0.8) → engine MUST process and SHOULD emit warning if site is older.
- Higher minor (engine 0.8 reading site 0.9) → engine MUST attempt; unknown fields MUST be preserved (§7.6); MAY emit warning.
- Different major → engine MAY refuse with `mosaic.config.version-unsupported`. If it processes, it MUST emit warning.

Breaking changes between minor versions are permitted until 1.0. After 1.0, semver semantics.

---

## 10. Design tokens

### 10.1 Where tokens live

Design tokens are content. They live in a `tokens` singleton at the site root (`tokens.json`), declared in `mosaic.json#singletons` like any other singleton. Alternatively, small token sets MAY be declared inline in `mosaic.json#tokens`.

If both exist, the singleton wins. Engines SHOULD emit `mosaic.tokens.duplicate-source` warning.

### 10.2 Token shape (DTCG)

The token payload conforms to the [W3C Design Tokens Community Group format](https://design-tokens.github.io/community-group/format/). Mosaic does not redefine the format; it defines only the location and addressing.

Minimal example:

```json
{
  "color": {
    "background":   { "$value": "#ffffff", "$type": "color" },
    "text":         { "$value": "#0a0a0a", "$type": "color" },
    "accent":       { "$value": "#0066cc", "$type": "color" }
  },
  "font": {
    "body":         { "$value": "system-ui, sans-serif", "$type": "fontFamily" },
    "size-base":    { "$value": "16px", "$type": "dimension" }
  }
}
```

Engines that don't understand DTCG MUST still preserve the payload verbatim (§7.6). DTCG-aware renderers emit tokens as CSS custom properties or theme-system variables.

### 10.3 Referring to tokens

A token MAY be referenced from any record JSON using `ref:tokens@<path>`. The selector path uses dot notation matching the DTCG hierarchy:

- `ref:tokens@color.accent` → the accent color.
- `ref:tokens@font.body` → the body font.

Engines MUST resolve these refs to the token's `$value`.

### 10.4 Out of scope for tokens in 0.8

The following are not in 0.8:

- Per-page token overrides
- Per-component token overrides
- Per-record token overrides
- Token aliases / `$ref` inside DTCG

These will be addressed alongside layouts in a future MIP cluster.

---

## 11. Out of scope

Deliberately not in the base spec:

- Layouts (responsive grid, breakpoints, area assignment)
- Per-page / per-component / per-record design overrides
- Authentication, authorization, access control
- Locale-prefixed URL routing (`/uk/about` etc.) — engines own routing; the spec only owns content shape
- Per-locale asset variants (`hero.uk.jpg`) — author via a translatable field whose values are `asset:` refs
- Drafts, revisions, workflow states
- Hosting, deployment, CDN
- Search indexes
- Editor UI, preview, live reload
- MDX

These are engine, host, or tooling concerns. Mosaic describes content, not delivery.
