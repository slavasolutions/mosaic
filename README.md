# Mosaic

A portable document format for structured web content.

A Mosaic document is a directory tree on disk: `mosaic.json` describing the site's content shapes, plus content records in `content/`, plus assets in `assets/`. Any conforming reader can parse it, validate it, and render it.

The format is independent of any rendering engine. You can build a Mosaic document by hand, generate it from a CMS, or produce it as the output of a static site generator. Anyone can read it.

## Status

**v0.5** — current. Stripped portable-format release. Breaking changes between minor versions are possible until v1.0.

See [`spec.md`](spec.md) for the normative specification. Read Appendix F first if you want to know what got cut from earlier drafts and why.

## What's here

- [`spec.md`](spec.md) — normative specification (the source of truth)
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

Spec text: CC0 1.0 Universal (public domain). Use it however you want, including in commercial products, without attribution.

Code in this repo (validators, schema tooling, etc.) is MIT-licensed unless otherwise noted.
