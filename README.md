# Mosaic

**An open document format for websites.**

Mosaic is a folder-based, JSON-and-Markdown specification for representing a website as a structured, versionable, portable document. It is presentation-agnostic, framework-agnostic, and designed to be readable and editable without specialized tooling.

A Mosaic site is a directory of plain files. Pages are JSON. Long-form bodies are Markdown. Images and other binary assets sit at human paths with a manifest mapping to content hashes. A schema at the root defines the block types, slots, design tokens, and collections that the site uses.

Mosaic is the format. Clear ([clear-cms.com](https://clear-cms.com)) is the reference implementation — a live, collaborative engine that reads and writes Mosaic. Other engines, static-site generators, and tools can implement Mosaic too.

---

## Why a format

Most CMSes invent their own internal data model and expose it only through proprietary APIs. Migrating between them means rewriting your content. Reading them outside the tool is hard. Editing without the tool is impossible.

Mosaic is the opposite. It's just files. Any text editor can open them. Git can version them. Any tool that reads JSON and Markdown can understand them. Migration is `cp -r`. The format outlives any single engine.

This is the same insight Markdown had: a content format with no vendor, no runtime requirement, readable by humans, supported anywhere because the format is open.

## What Mosaic is good at

- **Structured content.** Every section of every page is a typed block with named slots — not a freeform blob of HTML.
- **Portability.** A Mosaic site is a folder. Backup is `cp`. Migration is `mv`. Inspection is `cat`.
- **Versionability.** Files in version control. Diffs are readable. Branches and pull requests work normally.
- **Collaboration-ready.** The format is designed to be written to by a CRDT engine (which is what Clear does) but it is also writable by hand, by static-site generators, by AI agents, by anything that can write JSON.
- **Renderer-agnostic.** Astro, Next.js, Eleventy, Hugo, custom — anything that reads JSON can render a Mosaic site.

## What Mosaic is not

- Not an engine. Doesn't run. Doesn't render. Doesn't sync.
- Not a CMS. A CMS implements Mosaic. Mosaic itself has no admin UI.
- Not a binary. Plain text files only (with binary assets at known paths).
- Not opinionated about hosting, deployment, or editing experience.

---

## Anatomy of a Mosaic site

```
my-site/
├─ mosaic.json                       Schema, tokens, collections (the "spec for this site")
├─ content/
│  ├─ pages/                         Page records (structure + slot refs)
│  │  ├─ index.json
│  │  └─ pricing.json
│  ├─ blog/                          Records + Markdown bodies
│  │  ├─ a-site-is-a-document.json
│  │  └─ a-site-is-a-document.md
│  └─ collections/                   Reusable typed records
│     ├─ ctas.json
│     ├─ pillars.json
│     └─ testimonials.json
├─ assets/
│  ├─ manifest.json                  Path → sha256 mapping
│  └─ images/
│     ├─ hero.jpg
│     └─ logo.svg
└─ blocks/                           Optional: engine-internal block instances
   └─ sha256/
```

Every file is plain text or a normal binary asset. Nothing is opaque. There is no `.db`, no proprietary container, no required runtime to make sense of the folder.

### `mosaic.json` — the site schema

The root schema declares what's allowed in this site: block types, their variants and slots, design tokens, collection schemas. It is the contract every page in the site obeys.

```json
{
  "meta": { "name": "my-site", "schemaVersion": 1 },
  "tokens": {
    "color": { "ink": "#0a0a0a", "accent": "#2a5fff" },
    "font":  { "body": "system-ui, sans-serif" }
  },
  "blockTypes": {
    "hero": {
      "variants": ["centered", "split"],
      "slots": {
        "headline": { "type": "text", "required": true },
        "media":    { "type": "asset", "accept": ["image", "video"] }
      }
    }
  },
  "collections": {
    "blog": { "schema": "blogPost", "indexBy": "publishedAt" }
  }
}
```

### `content/pages/*.json` — page records

A page is a record with metadata and a list of sections. Each section names a `blockType` from the schema and fills its `slots`.

```json
{
  "title": "Home",
  "slug": "/",
  "status": "published",
  "sections": [
    {
      "id": "sec_hero",
      "blockType": "hero",
      "variant": "split",
      "slots": {
        "headline": "A site is a document.",
        "media": "asset:images/hero.jpg"
      }
    }
  ]
}
```

### `content/blog/*.{json,md}` — record + body

Where a record has long-form prose, the prose lives in a sibling Markdown file:

```json
{
  "title": "A site is a document",
  "slug": "a-site-is-a-document",
  "publishedAt": "2026-05-09",
  "body": "asset:content/blog/a-site-is-a-document.md"
}
```

The Markdown is plain Markdown. No proprietary frontmatter required (the JSON is the frontmatter).

### `assets/manifest.json` — path → hash

```json
{
  "version": 1,
  "paths": {
    "images/hero.jpg": "sha256-abc123...",
    "images/logo.svg": "sha256-def456..."
  }
}
```

This lets refs like `asset:images/hero.jpg` stay stable across renames. The manifest is the source of truth for "which file is currently at this path."

---

## Reference shapes

A Mosaic site uses four reference shapes inside JSON values:

| Shape                        | Resolves to                                       |
|------------------------------|---------------------------------------------------|
| `asset:images/hero.jpg`      | A binary asset (path-keyed, manifest resolves)    |
| `asset:content/blog/x.md`    | A long-form Markdown body                         |
| `ref:blog/a-site-is-a-document` | A record in a collection                       |
| `block:sha256-abc123...`     | A serialized block instance (engine-internal)     |

These are the only ref shapes Mosaic defines. Everything else is plain content.

---

## Format reference

### Closed slot type taxonomy

Every slot in a `blockType.slots` declaration takes a `type` from this fixed set:

| Type | Value shape | Notes |
|------|-------------|-------|
| `text` | plain string | Optional `maxLength`. |
| `richtext` | string (Markdown by default) or Portable Text object | `format: "markdown" \| "portable-text"`. |
| `asset` | `asset:path` string | Optional `accept: ["image" \| "video" \| "audio" \| "font" \| "svg" \| "pdf"]`. |
| `ref` | `ref:collection/id` string | `refTo: <collection>` required. |
| `list` | array of values | `of: <type>` required (`"string"`, `"number"`, `"ref:<collection>"`, `"struct:<name>"`); optional `min` / `max`. |
| `struct` | object | `name: <struct-name>` references a struct definition in the schema. |
| `code` | `{ lang, body }` object | `lang: ["ts", "json", "md", ...]` optional whitelist. |
| `number` | number | Optional `min` / `max`. |
| `boolean` | boolean | |

Slot common fields: `type` (required), `required: bool`, `description: string`.

### Block type shape

```json
"hero": {
  "variants": ["centered", "split", "fullbleed"],
  "slots": { "headline": { "type": "text", "required": true }, ... },
  "layout": { "direction": "row" | "column", "gap": "stack" | "block" | "section", "align": "start" | "center" | "end" | "stretch" }
}
```

`variants` is a closed identifier list. Renderers may style each variant; validators reject section instances referencing undeclared variants. `layout` is an optional hint — renderers SHOULD respect it where it makes sense.

### Section instance lifecycle

Every section in a page's `sections[]`:

```json
{
  "id": "sec_hero",
  "blockType": "hero",
  "variant": "split",
  "state": "published" | "draft",
  "publishedHash": "sha256-..." | null,
  "slots": { ... }
}
```

- **`state`** — `"published"` (renderer serves) or `"draft"` (only editor sees).
- **`publishedHash`** — canonical hash of the last published slot content. Implementations using the hybrid storage tier (block bodies as content-addressed blobs) populate this; pure file-only sites can leave it null.

### Page record shape

```json
{
  "title": "Home",
  "slug": "/",
  "status": "published" | "draft",
  "publishedVersion": "ISO timestamp",
  "publishedAt": "YYYY-MM-DD",
  "author": { "name": "...", "handle": "..." },
  "seo": { "title": "...", "description": "...", "ogImage": "asset:..." },
  "layout": "default",
  "sections": [...]
}
```

Required: `title`, `slug`, `status`, `sections`. All others optional. `author` and `publishedAt` apply to any page (not just blog posts).

### Collections + records

`mosaic.json` declares a collection with `schema` (struct name) and optional `indexBy` (sort field). Two record-layout options:

1. **One file holds all records** — `content/collections/<name>.json` with `{ schema, entries: { id: {...}, ... } }`.
2. **Records on the path** — `content/<name>/<id>.json` per record. Preferred for collections with many records or with URL semantics; consistent with `content/pages/` and `content/blog/`.

Schema declares URL pattern optionally: `"blog": { "schema": "blogPost", "urlPattern": "/blog/{slug}", "indexBy": "publishedAt" }`. Collections without `urlPattern` are embedded-only (referenced from sections, no URL).

### i18n

Locale set declared in the schema:

```json
{
  "i18n": {
    "defaultLocale": "en",
    "locales": ["en", "fr", "es"],
    "routing": "prefix" | "subdomain" | "domain",
    "fallback": "default" | "404"
  }
}
```

Two translation patterns:
- **Per-locale page tree** — `content/pages/en/about.json`, `content/pages/fr/about.json`. Different sections allowed per locale.
- **Field-level translation** — locale-keyed values: `{ "label": { "en": "Get started", "fr": "Commencer" } }`. Used for tokens, CTAs, shared records.

Long-form bodies suffix with locale: `a-site-is-a-document.en.md`, `.fr.md`.

A slot can declare `translatable: true` in its definition; the value becomes a locale map.

### Globals (optional)

Site-wide singletons declared in `mosaic.json#globals`. Each global has a `blockType`, an injection `position` (`page-top` / `page-bottom` / `page-side-left/right` / `before:<id>` / `after:<id>` / `before-section:N` / `after-section:N`), and points at an instance file like `globals/site-header.json`. Globals can `repeat: "every N sections"` for sticky asides or interstitials.

Per-page override via `globalsOverride: { <id>: "off" | "override" | { instance: <path> } }` on the page record. Full grammar in [`spec.md`](./spec.md#9-globals-optional).

### Overlays (optional)

Off-flow elements that are NOT part of the document flow: lightboxes, modals, drawers, newsletter popups, cookie consent, exit-intent offers, toasts. Declared in `mosaic.json#overlays` with a `blockType`, a `trigger` (`manual` / `auto-image-links` / `scroll:N%` / `delay:Nms` / `exit-intent` / `first-visit`), and a `persist` window (`session` / `forever` / `dismissed-for-7d`). In-content links of the form `<a href="#overlay:<id>">` open the named overlay. Full grammar in [`spec.md`](./spec.md#10-overlays-optional).

### Encoding

UTF-8 throughout. Path identifiers (`slug`, asset paths, collection names) MUST be URL-safe ASCII (`[a-z0-9_-/]`). JSON files SHOULD use 2-space indent and trailing newline.

---

## How Mosaic relates to existing web standards

Mosaic sits **above** the web's rendering and authoring standards, not beside them. It composes existing open standards rather than replacing them.

```
              Mosaic (editable source)
                       ↓
      [render layer: Astro / Next / custom]
                       ↓
       HTML + Schema.org + Open Graph + RSS
                       ↓
                  the browser
```

- **HTML** is what a Mosaic site renders to. Mosaic doesn't replace HTML; HTML is downstream.
- **Markdown** is used for long-form prose inside Mosaic sites. Mosaic doesn't reinvent rich text — it embeds Markdown.
- **Schema.org / JSON-LD** is emitted by the renderer from page metadata. Mosaic page records carry SEO metadata; the renderer produces Schema.org output.
- **Open Graph** tags are emitted from `seo.*` fields in records.
- **RSS / Atom** feeds are produced from collections (e.g. `blog`).
- **Portable Text** is the recommended rich-text shape for slots that need inline structured embeds beyond plain Markdown.
- **JSON Schema** validates `mosaic.json` itself (planned).

These existing standards answer questions about a single page being delivered to a browser. Mosaic answers a different question: **what is a website, as an editable document, with multiple pages, reusable blocks, design tokens, collections, and multi-language content?**

That question doesn't have a current standard. Hugo, Astro, and Eleventy each have their own folder conventions, but those are tool-specific patterns, not open specs. JCR and CMIS are old enterprise CMS standards focused on document management, not modern websites. Mosaic fills the gap by composing the standards above into one open spec for the substrate.

---

## Standards Mosaic embeds

Beyond the rendering-target standards above, Mosaic directly embeds these specs in its file format:

- **JSON** for structured records and schema.
- **Markdown** (CommonMark + GFM) for long-form bodies.
- **JSON Schema** for validating site schemas (planned).
- **Portable Text** ([portabletext.org](https://portabletext.org)) as the recommended representation for rich-text slots that need inline formatting beyond plain Markdown.
- **Schema.org** vocabularies for SEO metadata where appropriate.
- **sha256** content addressing for binary assets and block instances.

Mosaic is the convention that ties these together into a complete, browseable, structured website-as-a-document.

---

## Status

Mosaic is at **v0.1**. The format shape is settling but the spec is not yet final. Breaking changes are possible until v1.0. The reference implementation (Clear) drives the spec forward; community input is welcome via issues and pull requests.

The longer normative spec lives in [`spec.md`](./spec.md) — covers conformance levels, the reference resolution algorithm, manifest semantics, and the JSON Schema for `mosaic.json`. This README is the introduction + anatomy + format reference; `spec.md` is the validator's-eye view.

## Reference implementation

[Clear](https://clear-cms.com) is the live, collaborative engine that reads and writes Mosaic. It provides:

- Real-time multiplayer editing
- Schema validation against the site's `mosaic.json`
- A hosted runtime, a self-host option, and a drop-in package for Next.js / Astro / SvelteKit apps
- A studio (visual canvas + form-fill editor)
- A Figma plugin

Clear is one implementation. Others are encouraged.

## Other implementations

_None yet._ If you build one, open an issue and we'll list it here.

Possible directions:
- A static-site generator that reads Mosaic and outputs HTML (no runtime, no engine, just files in → files out)
- An LLM toolchain that produces valid Mosaic from prompts
- Adapters from other CMSes (Sanity, Contentful, Payload, WordPress) into Mosaic
- A migration tool from Markdown-front-matter conventions (Hugo, Astro Content Collections, Eleventy) to Mosaic

---

## FAQ

**Doesn't HTML already cover this?**
HTML answers "what does this single page render as in a browser?" Mosaic answers "what is a whole website, as an editable source, with reusable blocks, design tokens, collections, multi-language content, and asset references?" HTML is a delivery format; Mosaic is the editable substrate that produces HTML. They sit at different layers and don't compete. Hugo, Astro, and Eleventy each have folder conventions for this layer, but those are tool-specific patterns, not open specs. Mosaic fills that gap.

**Is Mosaic a competitor to Markdown?**
No. Mosaic uses Markdown for long-form prose. Mosaic is what wraps Markdown — the structured shape of a whole website.

**Is Mosaic a competitor to Portable Text?**
No. Portable Text is a rich-text-block format (one paragraph at a time). Mosaic is a whole-site format. Mosaic recommends Portable Text inside rich-text slots when plain Markdown isn't enough.

**Why not just use Astro Content Collections / Hugo / Eleventy formats?**
Those are conventions inside specific tools, not specifications. Mosaic formalizes the shape so multiple tools can read and write the same content. A Hugo site can be moved to Eleventy in theory; in practice it requires rewriting frontmatter, rebuilding components, and migrating shortcodes. A Mosaic site moves between Mosaic engines without conversion.

**Why not use a database-backed CMS export format?**
Database CMSes export their internal model (rows, joins, relationships). The export is shaped by the database, not by the website. Mosaic's shape is the website itself.

**Does Mosaic require a CRDT?**
No. The format is just files. A CRDT engine (like Clear) can produce and consume Mosaic, but so can a hand-edited folder, a static-site generator, or an AI agent.

**Can I edit Mosaic by hand?**
Yes. That's a design goal. JSON and Markdown, no proprietary tooling required.

**What's the file extension?**
The format is just files: `.json` and `.md`, plus normal asset extensions. There is no custom extension because the goal is universal tool support. Snapshot exports from CRDT engines may use engine-specific extensions (Clear uses `.clear` for binary snapshots) but those are engine concerns, not part of the Mosaic spec.

---

## Contributing

The spec lives in this repository. Contributions welcome:

- **Spec issues / PRs** — clarifications, corrections, additions to [`spec.md`](./spec.md)
- **Reference implementations** — link them here once shipped
- **Adapters** — tools that read or write Mosaic from other formats
- **Examples** — sample Mosaic sites are useful for newcomers

Open an issue to discuss before sending large PRs.

## License

The Mosaic specification is dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Implementations are independently licensed by their authors.

---

Mosaic is developed alongside [Clear](https://clear-cms.com) but the format is intentionally separate. The goal is a living open standard, not a vendor format.
