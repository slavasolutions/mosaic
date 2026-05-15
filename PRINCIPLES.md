# Mosaic — Principles

The Mosaic spec sits on three foundational claims. Every rule in `SPEC.md` derives from one of them. Every MIP records a decision made under one. If a claim changes, the spec changes; if a claim holds, the spec holds.

Read this first. Argue with it before arguing with the spec.

---

## The folder is the website

The filesystem is the source of truth; nothing else is canonical.

A site is a directory tree on disk. Files in that tree are **records**: `.json` carries structured data, `.md` carries prose, any other extension carries binary or non-text content. Folders group records into **collections**. The root folder holds the manifest (`mosaic.json`) plus the site's records and collections.

## Refs link records

One `ref:` prefix with three anchoring modes: cascade lookup (default — walks the parent chain outward), `/` for absolute from root, `./` for explicit relative.

Refs resolved at any depth follow **deeper-wins cascade plus deep-merge**: a same-named record placed deeper in the tree overrides a shallower one, with objects merging by field and arrays replacing whole. Cycles are free.

## Forward-safe

Engines decide URLs. Writers preserve unknown fields. Extensions namespace themselves with the `x-` marker (fields as `x-<ns>.<key>`; sidecar files as `<slug>.x-<ns>.json`).

Types in `mosaic.json#types` MAY declare an optional `@type` field naming a schema.org type (`Person`, `Article`, `Event`, etc.). When present, engines that emit JSON-LD use it automatically for SEO and AI discoverability; when absent, engines emit plain HTML. Schema.org alignment is per-type, not per-site.

---

## What stays out

These were considered and intentionally not promoted to principles:

- **Layouts** — responsive grids, breakpoints. Future MIP cluster once authoring experience exists.
- **Per-page / per-component design overrides.** Deferred until layouts land.
- **Locale-prefixed URL routing** (e.g. `/uk/about`). Engine concern; future MIP paired with folder-style locale.
- **Auth, drafts, revisions, search indexes, deployment.** Engine and host concerns, not content shape.
- **MDX.** Still out.

If any of these matter for your engine, build them as engine extensions. Forward-safety means engine-specific data survives a round-trip through other engines without loss.

---

## How this file relates to the rest

- **This file (`PRINCIPLES.md`)** — foundational claims. Plain language. No MUST/MAY.
- **`SPEC.md`** — the precise rules that implement these claims. RFC-2119 language.
- **`mips/MIP-NNNN.md`** — the decisions and alternatives behind each rule. Historical record.

If the same fact lives in two of these files, that is a bug. Delete one.
