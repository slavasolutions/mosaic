# Mosaic

A portable document format for structured web content.

A Mosaic document is a directory tree on disk: `mosaic.json` describing the site's content shapes, plus content records in `content/`, plus assets in `assets/`. Any conforming reader can parse it, validate it, and render it.

The format is independent of any rendering engine. You can build a Mosaic document by hand, generate it from a CMS, or produce it as the output of a static site generator. Anyone can read it.

## Status

**v0.5** — current. Stripped portable-format release. Breaking changes between minor versions are possible until v1.0.

See [`spec.md`](spec.md) for the normative specification. Read Appendix F first if you want to know what got cut from earlier drafts and why.

## What's here

- [`spec.md`](spec.md) — normative specification (the source of truth)
- [`mosaic.schema.json`](mosaic.schema.json) — JSON Schema 2020-12 for `mosaic.json` (static-shape validator; see spec Appendix D)
- [`examples/`](examples/) — example Mosaic documents (document-only, no rendered output)
- [`proposals/`](proposals/) — Mosaic Improvement Proposals (MIPs)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to propose changes
- [`AGENTS.md`](AGENTS.md) — rules for LLMs and coding agents working in this repo

Superseded spec drafts (v0.1, v0.2-draft, v0.3-proposal) are not kept as files — see git history.

## What this is not

Mosaic is not a CMS, a renderer, or a JavaScript library. It's a file format. Implementations of the format are separate projects.

The reference implementation is [Clear](https://github.com/clearcms/clear), a live-editing engine that reads and writes Mosaic documents. Other implementations are encouraged.

## Implementations

| Project | Conformance | Notes |
| --- | --- | --- |
| [Clear](https://github.com/clearcms/clear) | Level 2 (Reader + Writer) | Live-editing engine; reference implementation |

To list a new implementation, open a PR adding a row.

## License

This repository is dual-licensed:

- **Specification text** (`spec.md`, `proposals/`, schema annotations) — [Creative Commons Attribution 4.0 International (CC BY 4.0)](./LICENSE-spec.md). You may copy, adapt, and redistribute the spec, including commercially, as long as you attribute the project.
- **Code** (validators, schema tooling, runnable examples, build scripts) — [Apache License 2.0](./LICENSE-code), which includes an explicit patent license grant.

Earlier v0.1–v0.5 releases were published under CC0 1.0; those releases remain CC0 forever. From this version forward, CC BY 4.0 applies to new spec text. See [`LICENSE-spec.md`](./LICENSE-spec.md) for reasoning.

## Trademark

"Mosaic," the Mosaic logo, and "Mosaic Improvement Proposal" / "MIP" are trademarks of Slava Solutions. The format is open; the name is not. See [`TRADEMARK.md`](./TRADEMARK.md) before naming a fork or product "Mosaic" or "Mosaic-something."

## Copyright

Copyright (c) 2026 Slava Solutions and the Mosaic project contributors. See `NOTICE`.

## Reporting security issues

See [`SECURITY.md`](./SECURITY.md). Do not file security issues as public GitHub issues.
