# MIP-0007: Root-level singletons

- **Status:** shipped (0.8)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.8

## Summary

Eliminate the `globals/` directory. Singleton records live at the **site root** as `<name>.json`, `<name>.md`, or a matching pair. Rename the `mosaic.json` key from `globals` to `singletons`. Ref grammar: `ref:globals/site` becomes `ref:site`.

## Motivation

The word "global" is ambiguous between two meanings:

1. **Cardinality** — "there is only one of it" (singleton).
2. **Rendering** — "appears on every page" (header, footer).

Mosaic's `globals/` meant the first. Readers naturally assumed the second. Worse, the directory added a layer for files that are characterized by being the *root-level distinguishing files of the site* — they belong at the root, not buried one level deep.

After the change, the root reads as: "here's what defines this site: the manifest, then the identity files, then pages / collections / images."

## Specification

See SPEC §1.4 and §5.3.

- Each entry in `mosaic.json#singletons` corresponds to a file at the site root: `<name>.json`, `<name>.md`, or both.
- Refs to singletons drop the `globals/` prefix: `ref:<name>` (no slash) addresses a singleton; `ref:<name>/<slug>` addresses a collection record. Parser splits on the first `/`.
- A singleton named X and a collection named X coexist; refs disambiguate by presence of `/`.
- Reserved root names (§1.7) cannot be singletons.

## Rationale and alternatives

| Option | Why rejected |
|---|---|
| Keep `globals/` | Word is ambiguous; folder doing no real work |
| Rename to `singletons/` directory | Accurate but still adds a directory layer |
| Rename to `site/` directory | Consumes the word "site" needed for the identity block and the singleton itself |
| Collapse into `collections/` with a cardinality flag | Most regular but harder to address (`ref:site/site`) and adds schema noise |

## Drawbacks

Sites migrating from 0.7 must move files and update refs. Mitigation: `mosaic migrate` handles this mechanically.

## Resolution

Shipped in 0.8.
