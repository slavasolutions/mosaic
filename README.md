# Mosaic

**A portable document format for structured web content.**

A Mosaic document is a directory of plain files: `mosaic.json` describes the content shapes, `content/` holds the records, `assets/` holds the binaries. Any conforming reader can parse it, validate it, and render it — independent of any CMS, framework, or rendering engine.

---

## The problem

Content gets trapped in tools.

A site built in Webflow lives in Webflow's database. A WordPress blog lives in MySQL behind a WordPress-shaped API. A Notion-as-CMS setup depends on Notion staying friendly forever. A Sanity studio depends on Sanity's runtime. When the tool changes hands, dies, or stops fitting, the content doesn't come with you — at best you get a JSON dump shaped like the tool you're leaving, not like a portable document. Migration is a rewrite.

Every CMS solves a slightly different problem, but they share the same architectural choice: structured content lives **inside** the platform. Mosaic inverts that. Structured content lives **on disk**, in human-readable JSON and Markdown, and platforms read it from there.

> "It's just files. Any text editor can open them. Git can version them. Migration is `cp -r`. The format outlives any single engine."

---

## What Mosaic is

A spec. Not a product, not a framework, not a piece of software. The repository ships:

- [`spec.md`](spec.md) — the normative spec (the source of truth)
- [`mosaic.schema.json`](mosaic.schema.json) — a JSON Schema 2020-12 validator for the static shape
- [`examples/`](examples/) — real, document-only Mosaic documents you can read end-to-end

A Mosaic document on disk looks like this:

```
my-site/
├─ mosaic.json                  # declares block types, slots, tokens, collections, i18n
└─ content/
   ├─ pages/
   │  └─ index.json             # a page = ordered list of typed section instances
   └─ blog/
      ├─ first-post.json        # collection records, typed by mosaic.json
      └─ second-post.json
```

The contract: any two conforming readers MUST produce the same understanding of what's there. That's the whole point. The format outlives any single engine.

Start with [`examples/minimal-site/`](examples/minimal-site/) — the smallest meaningful document. Then [`examples/blog-site/`](examples/blog-site/) for a collection with markdown bodies and typed refs between records.

---

## What this buys you

Three concrete scenarios the format is designed to support, in order of how mature they are today:

1. **Switching renderers without rewriting content.** A document rendered by an Astro adapter today can be rendered by a Next.js adapter tomorrow — same document, different output. No content migration, no schema translation.
2. **Headless consumers without `<missing template>` placeholders.** An RSS feed builder, a search indexer, or an AI summariser only implements the subset of block types it cares about. The spec's silent-skip rule (§6.1) lets them declare their support and drop the rest cleanly. Storage still preserves everything for other consumers.
3. **AI-driven content transformation** *(speculative — most interesting, least proven).* Because the content is structured typed JSON, an LLM can read a site, translate or restructure it, and write it back without losing the surrounding shape. This is the angle worth watching; it's also the one where the spec is youngest.

---

## What Mosaic is NOT

- **Not a CMS.** No admin UI, no editor, no database. Editors are separate projects.
- **Not a renderer.** Mosaic doesn't turn the document into HTML; engines do.
- **Not a JavaScript library.** The repo ships a spec + schema + examples. Use whatever language can read JSON.
- **Not opinionated about hosting, deployment, or editing workflow.**

The reference implementation is [Clear](https://github.com/clearcms/clear) — a live-editing engine that reads and writes Mosaic documents. Clear is downstream of the spec, not the other way around. Other implementations are encouraged; the implementations table is currently small on purpose.

---

## Status — honest version

**v0.6 (draft).** This is a 0.x format. Breaking changes between minor versions are possible until v1.0.

The v0.5 release was deliberately stripped: anything engine-scoped (canonical hashing, concurrent-merge semantics, layouts, globals, overlays, freeform absolute positioning) was cut from the format and pushed back into engines that need it. The spec is **smaller** than earlier drafts (v0.1, v0.2-draft, v0.3-proposal — preserved in git history). That's a feature: a portable format is only as portable as its narrowest waist.

v0.6 is the first MIP-cycle release on top of that stripped baseline. It adds no features. It tightens §7.4 cycle resolution into a deterministic walk (MIP-0001), makes two previously-implicit cross-field constraints explicit (§4.5 `min ≤ max`; §4.8 `locales` ⊇ `defaultLocale`), and adds a worked example for the §4.2a token cascade. See [`spec.md`](spec.md) Appendix B for the full change log.

If you're building production sites for clients, **don't standardize on Mosaic yet.** Wait until v1.0, or until at least one independent implementation exists alongside Clear. If you're exploring AI-driven content workflows, portable CMS alternatives, or content portability where format stability matters more than feature completeness, this is a reasonable place to prototype.

Read [`spec.md`](spec.md) Appendix F first if you want to know what got cut and why. Every contested design decision is logged there with reasoning.

---

## What's here

- [`spec.md`](spec.md) — normative specification (the source of truth)
- [`mosaic.schema.json`](mosaic.schema.json) — JSON Schema 2020-12 for `mosaic.json` (static-shape validator; see spec Appendix D)
- [`examples/`](examples/) — example Mosaic documents (document-only, no rendered output)
- [`tests/`](tests/) — adversarial test cases; see [`STRESS-TESTS.md`](STRESS-TESTS.md) for the catalog
- [`tools/`](tools/) — small, format-only dev utilities (currently: `viewer.html` — drag-drop structural inspector). See [`tools/README.md`](tools/README.md) for scope.
- [`proposals/`](proposals/) — Mosaic Improvement Proposals (MIPs)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to propose changes
- [`AGENTS.md`](AGENTS.md) — rules for LLMs and coding agents working in this repo

Earlier spec drafts (v0.1, v0.2-draft, v0.3-proposal) live in git history rather than as files.

---

## Implementations

| Project | Conformance | Notes |
| --- | --- | --- |
| [Clear](https://github.com/clearcms/clear) | Level 2 (Reader + Writer) | Live-editing engine; reference implementation |

To list a new implementation, open a PR adding a row.

## For implementers

To build a Mosaic reader:

1. Read [`spec.md`](spec.md) §§1–8 (core: conformance levels, file tree, `mosaic.json` shape, validation, reference resolution).
2. Validate `mosaic.json` against [`mosaic.schema.json`](mosaic.schema.json) as a fast path for structural errors.
3. Apply spec-text validation per §6 for cross-references the schema can't encode (blockType-resolves-to-declared, refs-point-at-existing-records, etc.).
4. Walk content records and resolve refs per §7 + Appendix C.

The spec also ships as an npm package for engines that prefer dependency-managed reads:

```bash
npm install @slavasolutions/mosaic-spec
```

Consume it read-only — spec changes go through the [MIP](proposals/) process here, not through vendored copies in your engine. See [`AGENTS.md`](AGENTS.md) for the discipline.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Bug fixes, example improvements, and new test cases land as direct PRs. Normative changes — anything that adds, removes, or alters what readers/writers MUST do — go through the [MIP](proposals/) process.

If you're an LLM or agent working in this repo, [`AGENTS.md`](AGENTS.md) is your source of truth. The format is the product; engine concerns belong in engines.

---

## License

Spec text: [CC0 1.0 Universal](LICENSE) (public domain). Use it however you want, including in commercial products, without attribution.

Code in this repo (validators, schema tooling, etc.) is MIT-licensed unless otherwise noted.
