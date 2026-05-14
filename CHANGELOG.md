# Changelog

## 0.8 — 2026-05-14 (draft)

Closes the interop holes left in 0.7 and adds the three features 0.7 deferred. No more "globals/" folder; `mosaic.json` becomes a real manifest; design tokens, redirects, and a home-route lock are first-class.

The 17 axioms in [`TRUTHS.md`](TRUTHS.md) are the foundation. Every rule in the spec traces back to one. Every MIP records the decision behind one.

### Shipped MIPs (new)

- **MIP-0007** — Root-level singletons (replaces `globals/`)
- **MIP-0008** — `mosaic.json` as full manifest (identity, types, collections w/ defaults, singletons, redirects, tokens)
- **MIP-0009** — Writers preserve unknown fields
- **MIP-0010** — Required-title uses the resolved value (closes 0.7 hole)
- **MIP-0011** — Design tokens as a root singleton (DTCG-aligned)
- **MIP-0012** — Redirects (first-class)
- **MIP-0013** — Home is `/` (auto-redirect from `/home`)

### Breaking changes from 0.7

- `globals/` directory → root-level singletons. Refs: `ref:globals/site` → `ref:site`.
- `mosaic.json#globals` key → `mosaic.json#singletons`.
- `pages/home.*` is now structurally invalid (was silently accepted in 0.7).
- Frontmatter in a markdown file is now structural (was undefined behavior in 0.7).
- `array` field shape: `of` MUST be present; `of: "ref"` is invalid — use `of: { "kind": "ref", "to": "<collection>" }`.

### Established (carried forward from 0.7)

- Top-level layout: `mosaic.json`, `pages/`, `collections/`, `images/`, plus root singletons.
- Three record content combinations (md / json / both).
- Two record locations (direct file/pair or folder with `index.*`).
- Slug regex `^[a-z0-9][a-z0-9-]*$`.
- Frontmatter forbidden in markdown.
- Title precedence: JSON > markdown H1 > filename slug.
- Four ref forms: `ref:`, `asset:`, `./`, `@selector`.
- Index shape as a normative interchange format.
- Stable error codes.

### Spec tightenings (no MIP, listed for the record)

- ABNF grammar for refs restored as SPEC §5.2.
- Ref detection rule made explicit: engines scan every string value for the four prefixes (SPEC §5.7).
- Selector grammar pinned: JSON path uses dot notation with integer array indices; heading-slug algorithm spelled out (SPEC §5.6).
- Sort tiebreaker pinned: ties break by slug ascending (SPEC §4.1).
- `images/manifest.json` shape lifted into SPEC §1.6.
- Native vs embedded engine modes documented (SPEC §0.2).
- Versioning policy expanded with the three reader/site version-skew cases (SPEC §9).

### Tools

`validate`, `index`, `init`, `infer`, `migrate`, `fix`, `render` — contracts in `tools/`. Reference Node implementations for `validate` and `render` ship under `tools/validate/impl/` and `tools/render/`.

### Tests

- Conformance corpus expanded. The 0.7 corpus had 7 filled tests and 18 stubs; the 0.8 corpus fills the priority stubs and adds new tests covering the new MIPs.
- `tests/conformance/024-globals-ref-pass/` renamed to `024-singleton-ref-pass/`.
- New tests cover: singleton + collection same name; required-title resolved from H1; home-route reserved; redirect loop; redirect collision; tokens singleton; tokens ref via selector.

### Schema

`mosaic.schema.json` ships as a real JSON Schema 2020-12 document (the 0.7 reference to `https://mosaic.dev/schemas/0.7.json` was a vapor URL).

### Known unfinished

- Property-based tests (`tests/property/`) not yet written.
- SQLite index format documented only at the field level; SQL schema not yet pinned.
- Per-page / per-component / per-record design token overrides deferred; will land alongside layouts.
- Layouts themselves still deferred — content spec stabilises first.

---

## 0.7 — 2026-05-14 (draft, superseded by 0.8)

First public draft. Shape settling toward 1.0.

### Shipped MIPs

- **MIP-0001** — Folder layout and record shapes
- **MIP-0002** — Ref grammar and selectors (`@selector` syntax)
- **MIP-0003** — Collection routing via `collection-list`
- **MIP-0004** — Stub-based ref expansion
- **MIP-0005** — Three-level validation severity (structural / drift / warning)
- **MIP-0006** — List-only mounts via `"routes": false`
