# Mosaic — Philosophy

The 0.9 spec sits on top of seven foundational claims. Every rule in `SPEC.md` derives from one of them. Every MIP records the decision behind one. If a claim changes, the spec changes; if a claim holds, the spec holds.

Read this first. Argue with it before arguing with the spec.

---

## The folder is the website

The filesystem is the source of truth; nothing else is canonical.

## `mosaic.json` is the manifest

One special file at the root identifies the folder as a Mosaic site and declares its shape — types, collections, redirects, tokens.

## Records compose sites

A record's index is a JSON file; markdown and other files are content referenced from it. Files at root are records; folders at root are collections of records; `pages` is the collection engines route from by convention.

## Refs link records

One `ref:` prefix, three anchors: cascade by default (search outward), `/` for absolute from root, `./` for explicit relative. Cycles free, lazy resolution.

## Routing is declared, not derived

Pages-collection paths become URLs; other collections appear as URLs only when a page mounts them.

## Deeper scope wins

Cascade lookup plus deep merge — any record can be overridden by a same-named record placed deeper in the tree. Objects merge field-by-field; arrays replace whole.

## Forward-safe

Engines decide URLs; writers preserve unknown fields; extensions namespace themselves with one `<ns>` identifier (fields as `$<ns>.<key>`, sidecar files as `<slug>.x-<ns>.json`).

---

## What stays out

These were considered and intentionally not promoted:

- **Layouts** — responsive grids, breakpoints, area assignment. Future MIP cluster once authoring experience exists.
- **Per-page / per-component / per-record design overrides.** Deferred until layouts land.
- **Locale-prefixed URL routing** (e.g. `/uk/about`). Engine concern; future MIP paired with folder-style locale.
- **Per-locale asset variants** beyond translatable-field refs.
- **Auth, drafts, revisions, search indexes, deployment.** Engine and host concerns, not content shape.
- **MDX.** Still out.

If any of these matter for your engine, build them as engine extensions. Forward-safety means engine-specific data survives a round-trip through other engines without loss.

---

## How this file relates to the rest

- **This file (`PHILOSOPHY.md`)** — foundational claims. Plain language. No MUST/MAY.
- **`SPEC.md`** — the precise rules that implement these claims. RFC-2119 language.
- **`mips/MIP-NNNN.md`** — the decisions and alternatives behind each rule. Historical record.

If the same fact lives in two of these files, that is a bug. Delete one.
