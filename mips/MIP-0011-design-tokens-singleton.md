# MIP-0011: Design tokens as a root singleton

- **Status:** shipped (0.8)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.8

## Summary

Design tokens live in a `tokens` singleton at the site root (`tokens.json`), shaped per the [W3C Design Tokens Community Group format](https://design-tokens.github.io/community-group/format/). Mosaic defines where tokens live and how they're addressed; it does not redefine the DTCG format.

Tokens MAY alternatively be declared inline in `mosaic.json#tokens` for small token sets. If both exist, the singleton wins.

## Motivation

Every Mosaic site eventually needs color, font, and spacing values. Putting them in records is wrong (tokens are not editorial content); leaving them out of the spec is wrong (every engine invents its own location); inventing a Mosaic-specific format is wrong (DTCG exists, is well-designed, and has industry uptake).

By scoping Mosaic's responsibility to **location** and **addressing**, the spec stays small while making tokens first-class.

Per-page / per-component / per-record token overrides are deferred to a future MIP cluster alongside layouts. Site-wide tokens are the first cut.

## Specification

See SPEC §10.

- Tokens live in `tokens.json` (and optionally `tokens.md` for documentation) at the site root.
- The singleton MUST be declared in `mosaic.json#singletons` like any other singleton.
- The payload MUST conform to the DTCG format. Engines that don't understand DTCG MUST preserve the payload verbatim (per MIP-0009).
- Tokens are referenced via `ref:tokens@<dotted.path>`, where the path uses the DTCG hierarchy.
- DTCG-aware engines emit tokens as CSS custom properties, theme variables, or platform-native equivalents.
- Engines MUST resolve a token ref to the token's `$value`.

## Rationale and alternatives

| Option | Why rejected |
|---|---|
| Define a Mosaic-specific token shape | DTCG already exists, is broadly adopted, and is open-standard |
| Store tokens in `mosaic.json` only | Tokens grow; a manifest meant to describe types and bindings shouldn't carry palette files |
| Put tokens in `pages/_tokens.json` | Underscore-prefixed names are reserved; pages/ is for routed content |
| Use a `tokens/` directory with multiple files | Premature; DTCG already supports nested groups in one document. Multi-file tokens can be a future MIP if authoring experience demands it |
| Allow per-page overrides today | Deferred until layouts land. Without layouts, the rendering surface is too thin to validate the override surface |

## Drawbacks

DTCG itself is still evolving (community-group status, not a W3C Recommendation). If DTCG breaks compatibility, Mosaic sites following it inherit the break. Mitigation: pin to a specific DTCG draft date in spec text once usage hardens.

Token authoring outside a dedicated tool is verbose. Mitigation: encourage tooling (`mosaic init` ships a starter `tokens.json`; design-tool exporters target DTCG natively).

## Resolution

Shipped in 0.8.
