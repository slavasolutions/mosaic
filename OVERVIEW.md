# Mosaic — guided tour

A one-page walkthrough of what Mosaic is, what it isn't, and how the pieces fit together. Read this before the spec.

---

## What you're looking at

Mosaic is a **folder shape** for web content. A site is a directory tree. A tool that understands the shape can turn it into a website. Different tools, same folder, same site.

That's the whole pitch. The rest of this repo is the precise rules + the proof.

---

## The five things on disk

```
my-site/
├── mosaic.json        ← the manifest (what this site is)
├── pages/             ← routed pages
├── collections/       ← things you have many of
├── images/            ← binary assets (optional)
└── *.json / *.md      ← singletons at the root (site, header, footer, tokens, …)
```

That's the full surface. If you can read those five things, you can build a Mosaic engine.

---

## The flow

```
   ┌────────────┐
   │ Author     │  edits files in a folder (any editor, git, AI agent)
   └─────┬──────┘
         │
         ▼
   ┌────────────┐
   │ Validate   │  walks the folder, reports diagnostics
   └─────┬──────┘   structural · drift · warning
         │
         ▼
   ┌────────────┐
   │ Index      │  emits a queryable JSON document of the whole site
   └─────┬──────┘   (the wire format other tools consume)
         │
         ▼
   ┌────────────┐
   │ Consumer   │  renders HTML, feeds Astro/Next, syncs to a CMS, etc.
   └────────────┘
```

Each step is independent. Authors don't care which renderer ships next. Renderers don't care which editor produced the folder. Mosaic is the shared shape.

---

## Reading order

1. **[`TRUTHS.md`](./TRUTHS.md)** — 17 axioms. The whole spec derives from them. If you disagree with a truth, the spec won't convince you.
2. **[`examples/minimal-site/`](./examples/minimal-site/)** — the smallest valid Mosaic site. ~3 files. Read top to bottom.
3. **[`examples/hromada-community/`](./examples/hromada-community/)** — the canonical example. A real-feeling community site. Read top to bottom.
4. **[`spec/SPEC.md`](./spec/SPEC.md)** — the precise rules. Every MUST/MUST NOT traces back to one of the 17 truths.
5. **[`examples/complex-site/`](./examples/complex-site/)** — pushes the format. Every feature exercised in one site.
6. **[`mips/`](./mips/)** — the decisions and why. Read individual MIPs when the spec leaves you wondering "why like *this*?"

For implementers building a tool:

1. **[`mosaic.schema.json`](./mosaic.schema.json)** — validate `mosaic.json` files against this for free.
2. **[`tools/validate/README.md`](./tools/validate/README.md)** — the validator contract; error codes you'll emit.
3. **[`tests/conformance/`](./tests/conformance/)** — pass this corpus and your tool conforms.
4. **[`tools/validate/impl/`](./tools/validate/impl/)** — reference Node implementation. Copy patterns or use directly.
5. **[`tools/render/impl/`](./tools/render/impl/)** — reference renderer. Shows how to turn an index into HTML.

For embedding Mosaic into a host framework (Astro, Next, SvelteKit):

1. **[`tools/astro-adapter/`](./tools/astro-adapter/)** — Astro integration. Use as-is or as a pattern for other host frameworks.
2. **[`examples/astro-test/`](./examples/astro-test/)** — a working Astro project that consumes the hromada example via the adapter.

---

## The five kinds of content

Every piece of content in Mosaic is one of these:

| Kind | Lives in | Routed? | How to address it |
|---|---|---|---|
| **Page** | `pages/<path>.{md,json}` | yes (URL = path) | by URL |
| **Collection record** | `collections/<name>/<slug>.{md,json}` | only if a page mounts it | `ref:<name>/<slug>` |
| **Singleton** | `<name>.{md,json}` at site root | no | `ref:<name>` |
| **Asset** | `images/<path>` | no | `asset:images/<path>` |
| **Token** | `tokens.json` singleton, DTCG-shaped | no | `ref:tokens@<dotted.path>` |

Routing is declared by **pages**, not by collections. A page mounting `collections/news` is what creates `/news/some-story` URLs. The same collection can be mounted by multiple pages with different sorts and URLs.

---

## The four ref forms

```
ref:site                 → the singleton named "site"
ref:team/anna            → the team member named anna
asset:images/logo.svg    → an image
./bio.md                 → a file next to this JSON file
ref:site@contact.email   → just the email field of the site singleton
ref:tokens@color.accent  → the accent color from design tokens
```

Engines find refs by scanning string values for those prefixes. Schema doesn't decide what's a ref — the prefix does.

---

## Three validation levels

| Level | What it means | Engine behavior |
|---|---|---|
| **Structural** | Site can't be built | Refuse to produce index |
| **Drift** | Site can be built but is inconsistent | Produce index AND report |
| **Warning** | Cosmetic / informational | Produce index, optional report |

Every diagnostic has a stable code (e.g. `mosaic.ref.unresolved`, `mosaic.home.reserved`). Tools match on codes; messages may change between versions.

---

## What Mosaic isn't

- **Not a CMS.** No editor, no admin UI, no database. Editors are separate products that read and write the Mosaic shape.
- **Not a renderer.** Mosaic doesn't turn the folder into HTML. Engines do. This repo ships a reference renderer (`tools/render/`) and an Astro adapter (`tools/astro-adapter/`) so the spec has working consumers, but neither is the format itself.
- **Not a framework.** No runtime. No DOM. No JavaScript required to use Mosaic — JSON and Markdown plus a folder.
- **Not opinionated about hosting or deployment.** Static, dynamic, edge, CDN — all fine.

---

## What's in 0.8

- Folder shape, record shapes, refs, routing, validation, the index.
- The manifest (`mosaic.json`) as a real manifest, not a schema dump.
- Design tokens as a root singleton (DTCG-shaped).
- Redirects as first-class.
- Home locked to `/` (no `pages/home.*` confusion).
- Three example sites that build and validate end-to-end.
- Reference Node validator that passes the conformance corpus.
- Reference wireframe renderer that turns any of the three examples into a basic HTML site.
- Astro adapter so existing Astro sites can adopt Mosaic content with one integration.

## What's deferred to 0.9+

- Layouts (responsive grids, breakpoints).
- Per-page / per-component / per-record design overrides.
- i18n beyond a `locale` field.
- A SQLite index format that's pinned to a SQL schema.
- Property-based tests.
- Editor specs (editors are downstream products).

---

## If you're 10 minutes in and lost

You don't need to be a developer. The folder is the website. Open `examples/minimal-site/` in any file browser, open the files in any text editor, and read them. That's it.

If you don't see why this is worth a spec: it's because everyone who built a site before Mosaic had their content locked in a database, a framework, or a proprietary editor. When the tool died, the content died with it. Mosaic is the answer to "how do I keep my content alive longer than the tool I built it with?"

The folder is the website. The folder outlives any single tool.
