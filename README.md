# Mosaic

**Mosaic is a folder shape for websites.**

Put your content in a folder the Mosaic way, and any tool that speaks Mosaic can turn it into a website. Different tools, same folder, same site. No database. No platform lock-in.

## The whole idea, in one picture

```
my-site/
├── mosaic.json        ← the manifest: what this site is
├── pages/             ← one file (or folder) per page
├── collections/       ← things you have many of (news, team, services)
├── images/            ← pictures and binary assets
├── site.json          ← site-wide content (one of: singletons at the root)
├── header.json
├── footer.json
└── tokens.json        ← colors, fonts, spacing (DTCG-shaped)
```

That's it. The folder *is* the website.

## Why this exists

Most CMSes lock your content in a database. Most static site generators lock it in a framework. Mosaic doesn't lock anything anywhere — your content sits in plain files you can read, edit, move, and version with any text editor, any git repo, or any AI agent.

If you switch frameworks, your content moves with you. If you want an AI to edit your site, it can read the folder. If you want to peek inside, you open the folder.

## How content works

Every page, collection record, and singleton is one of three things:

- **A markdown file** — for pure writing.
- **A JSON file** — for pure data.
- **A markdown file plus a JSON file** — writing with structured fields beside it.

When you need to keep an image next to a page, make a folder instead of a single file. Same rules apply inside.

No frontmatter. JSON is where structured fields live.

## How links between things work

When one piece of content points to another, it uses a **ref**:

```
ref:site               → the singleton named "site" (at the root)
ref:team/anna          → the team member named anna
asset:images/logo.svg  → an image
./bio.md               → a file next to this one
ref:site@contact.email → just the email field of the site singleton
ref:tokens@color.accent → the accent color from design tokens
```

The `@` part is a **selector** — it picks out one part of the thing.

## How routing works

Pages become URLs. The path is the URL.

```
pages/index.md         → /
pages/about.md         → /about
pages/services.json    → /services
```

Collections don't become URLs on their own. A page picks them up by saying "list this collection here":

```json
{ "type": "collection-list", "from": "collections/news" }
```

That page then renders the list *and* creates a URL for each record (`/news/some-story`).

Home is always `/`. There's no `pages/home.*` — the spec reserves it. Engines automatically redirect `/home` to `/` so visitors and authors never collide on the spelling.

## What you can build

Anything you can build with a folder. A blog, a portfolio, a community site, a documentation site, a small e-commerce catalog. Mosaic doesn't care what the content *means* — just that it sits in the right shape.

The reference example at [`examples/hromada-community/`](./examples/hromada-community/) is a non-profit community site exercising every rule end-to-end. [`examples/minimal-site/`](./examples/minimal-site/) is the smallest valid site that does anything. [`examples/complex-site/`](./examples/complex-site/) pushes the format — tokens, redirects, multiple ref forms, deep collections.

## Status

**Version 0.8 — drafting toward 1.0.** The shape is settling. Breaking changes between minor versions still possible until 1.0.

The 0.8 release closes the interop holes from 0.7 and adds the three things 0.7 deferred: design tokens, redirects, and a home-route lock. See [`CHANGELOG.md`](./CHANGELOG.md) for the full diff.

## Where to look next

- **[`OVERVIEW.md`](./OVERVIEW.md)** — the one-page guided tour. Read this first if you've never used Mosaic.
- **[`TRUTHS.md`](./TRUTHS.md)** — the 17 axioms everything else derives from. Read this second.
- **[`docs/showcase.html`](./docs/showcase.html)** — visual showcase, open in any browser. For showing other people what Mosaic is.
- **[`examples/`](./examples/)** — three example sites you can read end-to-end.
- **[`spec/SPEC.md`](./spec/SPEC.md)** — the precise rules. For implementers.
- **[`mosaic.schema.json`](./mosaic.schema.json)** — JSON Schema 2020-12 validator for `mosaic.json`.
- **[`mips/`](./mips/)** — why each rule exists. For people who want to argue.
- **[`tools/`](./tools/)** — the helpers (`validate`, `index`, `init`, `infer`, `migrate`, `fix`, `render`).
- **[`tests/`](./tests/)** — the conformance suite. Run these to check a tool.

## Implementations

| Project | Notes |
| --- | --- |
| `tools/validate/impl/` | Reference Node validator. Passes the conformance suite. |
| `tools/render/` | Reference wireframe renderer. Turns a Mosaic site into basic HTML. |

To list a new implementation, open a PR adding a row.

## License

This repository is dual-licensed:

- **Specification text** (`SPEC.md`, `PRINCIPLES.md`, `mips/`, prose in `mosaic.schema.json`) — [Creative Commons Attribution 4.0 International (CC BY 4.0)](./LICENSE-spec.md). You may copy, adapt, and redistribute the spec, including commercially, as long as you attribute the project.
- **Code** (validators, schema tooling, runnable examples, build scripts) — [Apache License 2.0](./LICENSE-code), which includes an explicit patent license grant.

Earlier v0.1–v0.5 releases were published under CC0 1.0; those releases remain CC0 forever. From v0.9 forward, CC BY 4.0 applies to new spec text. See [`LICENSE-spec.md`](./LICENSE-spec.md) for reasoning.

## Trademark

"Mosaic," the Mosaic logo, and "Mosaic Improvement Proposal" / "MIP" are trademarks. The format is open; the name is not. See [`TRADEMARK.md`](./TRADEMARK.md) before naming a fork or product "Mosaic" or "Mosaic-something."

## Copyright

Copyright (c) 2026 Mosaic project contributors. See `NOTICE`.

## Reporting security issues

See [`SECURITY.md`](./SECURITY.md). Do not file security issues as public GitHub issues.
