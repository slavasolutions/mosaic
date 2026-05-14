# Changelog

## 0.7 — 2026-05-14 (draft)

First public draft. Shape settling toward 1.0.

### Shipped MIPs

- **MIP-0001** — Folder layout and record shapes
- **MIP-0002** — Ref grammar and selectors (`@selector` syntax)
- **MIP-0003** — Collection routing via `collection-list`
- **MIP-0004** — Stub-based ref expansion
- **MIP-0005** — Three-level validation severity (structural / drift / warning)
- **MIP-0006** — List-only mounts via `"routes": false`

### Established

- Top-level directories: `mosaic.json`, `pages/`, `collections/`, `globals/`, `images/`
- Three record content combinations (md / json / both)
- Two record locations (direct file/pair or folder with `index.*`)
- Slug regex `^[a-z0-9][a-z0-9-]*$`
- Frontmatter forbidden in markdown
- Title precedence: JSON > markdown H1 > filename slug
- Four ref forms: `ref:`, `asset:`, `./`, `@selector`
- Index shape as a normative interchange format
- Stable error codes

### Tools (v1)

`validate`, `index`, `init`, `infer`, `migrate`, `fix` — contracts documented in `tools/`.

### Tests

Conformance corpus introduced in `tests/conformance/`. 25 test slots, 7 filled in detail, 18 stubbed for future implementation. Reference Node.js runner in `tests/runner/run.js`.

### Known unfinished

- Property-based tests (`tests/property/`) not yet written.
- Sqlite index format documented only at the field level; SQL schema not yet pinned.
- Several conformance tests are stubs; expected.json fields are minimal.
