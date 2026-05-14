# `@mosaic/validate-ref`

Reference implementation of the Mosaic 0.8 `validate` tool. Zero external dependencies. Written to be the validator the conformance suite is run against.

## Run it

```
node validate.js --site <path> [--strict] [--json] [--quiet]
```

- `--site <path>` — required; path to the site root (the directory containing `mosaic.json`).
- `--json` — emit a single JSON document on stdout.
- `--strict` — exit non-zero if drift is present (default: only structural errors cause non-zero).
- `--quiet` — suppress human output (no-op when `--json` is set; stdout is JSON either way).

Exit codes:

| Code | Meaning |
|---|---|
| `0` | No structural errors (and no drift in `--strict` mode) |
| `1` | Structural errors present, or `--strict` and drift present |
| `64` | Invocation error (missing `--site`, bad args) |

## JSON output shape

```json
{
  "site": "<absolute path to the site>",
  "version": "<value of mosaic.json#version, or '0.8'>",
  "summary": { "structural": 0, "drift": 0, "warning": 0 },
  "diagnostics": [
    { "severity": "structural", "code": "mosaic.xxx", "source": "<rel-path>", "message": "..." }
  ],
  "routes": [
    { "url": "/", "kind": "page", "target": "..." },
    { "url": "/news/launch", "kind": "record", "target": "record:news/launch" },
    { "url": "/home", "kind": "redirect", "target": "/" }
  ]
}
```

Diagnostics are sorted by severity, then code, then source — deterministic across runs. Routes are sorted by URL.

## Mapping to the spec

Every implemented rule maps to SPEC.md and the diagnostic table in §6:

| Rule | Spec § | Code | Severity |
|---|---|---|---|
| `mosaic.json` missing/unparseable/schema-invalid | §0 §8 | `mosaic.config.invalid` | structural |
| Record has no markdown and no JSON | §2.1 | `mosaic.record.empty` | structural |
| Slug fails regex | §2.5 | `mosaic.slug.invalid` | structural |
| Two slugs collide only by case | §2.5 | `mosaic.slug.case` | structural |
| Markdown begins with frontmatter | §2.4 | `mosaic.frontmatter.present` | structural |
| `pages/home.*` exists | §3.2 | `mosaic.home.reserved` | structural |
| Two routes claim the same URL with different targets | §3.5 | `mosaic.route.collision` | structural |
| `collection-list#from` points at a non-existent collection | §4.1 | `mosaic.collection.missing` | structural |
| Declared singleton missing on disk | §8.5 | `mosaic.singleton.missing` | structural |
| Declared singleton collides with reserved root name | §1.7 | `mosaic.singleton.reserved` | structural |
| Ref grammar violated | §5.2 | `mosaic.ref.malformed` | structural |
| `./` ref in a record with no folder context | §5.5 | `mosaic.relative.invalid` | structural |
| Redirects form a cycle | §3.6 | `mosaic.redirect.loop` | structural |
| Redirect `from` collides with a real route | §3.6 | `mosaic.redirect.collision` | structural |
| `ref:` / `asset:` target doesn't exist | §5.3 / §5.4 | `mosaic.ref.unresolved` | drift |
| `@selector` doesn't resolve | §5.6 | `mosaic.selector.unresolved` | drift |
| Required field missing (after title-resolution) | §2.3 §6.3 | `mosaic.field.required` | drift |
| Record has field not in type | §6.3 | `mosaic.field.unknown` | drift |
| Field value doesn't match declared type | §6.3 | `mosaic.field.type-mismatch` | drift |
| Markdown H1 alongside JSON `title` | §2.3 | `mosaic.title.dead-h1` | warning |
| Asset in `images/` referenced nowhere | §6.4 | `mosaic.asset.orphan` | warning |
| Asset on disk but missing from `images/manifest.json` | §5.4 | `mosaic.asset.unmanifested` | warning |
| Collection has no mount and no inbound refs | §6.4 | `mosaic.collection.unmounted` | warning |
| Redirect duplicated by `from` in source array | §3.6 | `mosaic.redirect.duplicate-from` | warning |
| Both `mosaic.json#redirects` and `redirects` singleton exist | §3.6 §8.7 | `mosaic.redirect.duplicate-source` | warning |

## Layout

- `validate.js` — CLI entry; orchestrates the eight build steps from SPEC §7.2.
- `lib/diagnostics.js` — diagnostic accumulator with stable sort.
- `lib/manifest.js` — `mosaic.json` loader and shape validator (no external JSON Schema engine).
- `lib/walk.js` — filesystem walking, record-shape detection, slug rules, frontmatter detection.
- `lib/refs.js` — ref grammar parser (per ABNF in §5.2), resolver, selector resolution.
- `lib/routes.js` — page routes, collection-list expansion, redirect handling, collision detection.

## Run the conformance suite against this validator

```
node /home/ms/mosaic-0.7/mosaic-spec/tests/runner/run.js \
  --tool "node /home/ms/mosaic-0.7/mosaic-spec/tools/validate/impl/validate.js"
```

## Notes on ambiguous cases

- **0.7-era manifests** still in the test suite declare `globals` instead of `singletons`. To allow those sites to load without a hard `mosaic.config.invalid`, the manifest loader accepts `globals` as a synonym for `singletons` in this reference implementation. A pure 0.8 engine MAY reject the absence of `singletons` outright.
- **Relative refs in direct-shape records.** SPEC §5.5 calls out the markdown-only case specifically; this implementation extends the rule to any record whose JSON has no containing folder (i.e. direct-shape records, even with both `.md` and `.json` sidecars). The data dir is undefined there, so `./` has no anchor.
- **Heading-slug selector vs. JSON-path selector.** A bare single-segment selector like `@launch` could be either a top-level JSON key or a heading slug. The resolver tries JSON first (per §5.6 precedence), then markdown headings — matching the spec.
- **Same record routed by two `routes: true` mounts** at *different* URLs is reported as `mosaic.route.collision` on the record's path. Routing the same record at the *same* URL via two mounts is intentionally allowed and minted once.
