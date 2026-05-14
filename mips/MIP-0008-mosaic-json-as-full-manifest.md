# MIP-0008: mosaic.json as full manifest

- **Status:** shipped (0.8)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.8

## Summary

`mosaic.json` is expanded from "schema + minimal config" to a full manifest. It declares:

- `version`, `site` (identity)
- `types` (reusable record shapes)
- `collections` (with optional `defaultSort` and `defaultMount`)
- `singletons` (replaces `globals`)
- `redirects` (inline or via singleton)
- `tokens` (inline or via singleton; DTCG-shaped)

`mosaic init` reads a manifest and scaffolds a working folder from it. A manifest plus seed content is a shareable Mosaic template.

## Motivation

A `mosaic.json` containing only type definitions duplicates information the folder already encodes. To earn its place, the manifest should declare site identity, all singletons, all collections (with reasonable defaults), all redirects, and all design tokens — enough that a freshly-cloned manifest can scaffold a working folder.

This mirrors `package.json` / `Cargo.toml` / `pyproject.toml` / `composer.json` in code: the manifest declares intent, tooling realizes it on disk.

## Specification

See SPEC §8.

- `site`: identity metadata (name, locale, url) — used by tooling, indexers, deployment.
- `types`: unchanged from 0.7 with one tightening — `array` fields MUST declare `of`, and `ref` items use `{ "kind": "ref", "to": "<collection>" }`.
- `collections`: each entry MAY carry optional `defaultSort` and `defaultMount`. Both are non-normative for validation; they guide `init` scaffolding and serve as engine fallbacks.
- `singletons`: replaces `globals` (per MIP-0007).
- `redirects`: optional array of redirect rules (per MIP-0012).
- `tokens`: optional DTCG-shaped token payload (per MIP-0011).

The `mosaic.json#site` block (identity) and a root-level `site` singleton (content) coexist. They MAY have different `name` values. Tools read the manifest; renderers read the singleton.

## Rationale and alternatives

| Option | Why rejected |
|---|---|
| Keep `mosaic.json` minimal, defer manifest expansion | The file barely earns its place; the folder duplicates everything |
| Move site identity out into a root singleton | Mixes identity (metadata) with content (editorial); harder to reason about |
| Put `defaultMount` on each `collection-list` section | Couples display to schema; defaults belong in the manifest |
| Make `defaultMount` required | Forces routing decisions during schema design; defeats the point of defaults |

## Drawbacks

Slightly more verbose manifest. Mitigated by every new field being optional and `init` populating them on scaffolding.

## Resolution

Shipped in 0.8.
