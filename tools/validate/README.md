# `mosaic validate`

Walks a Mosaic site and reports structural errors, drift, and warnings per SPEC §6.

A reference implementation lives at `tools/validate/impl/`.

## Usage

```
mosaic validate [--site <path>] [--strict] [--json] [--quiet]
```

## Behavior

1. Load `mosaic.json`. If missing or malformed, emit `mosaic.config.invalid` and exit `1`.
2. Run the build algorithm (SPEC §7.2) steps 1–7. Do not emit the index.
3. Collect diagnostics. Print them grouped by severity.
4. Exit `0` if no structural errors. Exit `1` if structural errors. Exit `2` if drift present *and* `--strict` was set.

## Output (human)

```
Mosaic 0.8 site: ./examples/hromada-community

STRUCTURAL ERRORS  0
DRIFT              2
WARNINGS           1

drift  collections/news/2025-04-02-grant.json
       mosaic.ref.unresolved   "ref:images/grant-photo.jpg" — target not found

drift  pages/contact.json
       mosaic.selector.unresolved   "@contact.fax" — selector does not resolve

warn   images/icon-old.svg
       mosaic.asset.orphan   asset not referenced by any record
```

## Output (JSON, with `--json`)

```json
{
  "site": "./examples/hromada-community",
  "version": "0.8",
  "diagnostics": [
    { "severity": "drift", "code": "mosaic.ref.unresolved", "source": "...", "message": "..." }
  ],
  "summary": { "structural": 0, "drift": 2, "warning": 1 }
}
```

## Error codes

Full list per SPEC §6. Codes are stable; `message` text may change between versions.

### Structural

| Code                              | Meaning                                                      |
|-----------------------------------|--------------------------------------------------------------|
| `mosaic.config.invalid`           | `mosaic.json` missing, unparseable, or schema-invalid        |
| `mosaic.config.version-unsupported` | Version mismatch the engine refuses to read               |
| `mosaic.record.empty`             | Record has neither markdown nor JSON                         |
| `mosaic.slug.invalid`             | Filename does not match slug regex                           |
| `mosaic.slug.case`                | Two records collide only by case                             |
| `mosaic.route.collision`          | Two pages or mounts claim the same URL                       |
| `mosaic.collection.missing`       | `collection-list` references a non-existent path             |
| `mosaic.relative.invalid`         | A `./` ref used in a markdown-only record                    |
| `mosaic.frontmatter.present`      | Markdown file starts with a YAML/TOML frontmatter block      |
| `mosaic.home.reserved`            | `pages/home.*` exists; the slug `home` is reserved           |
| `mosaic.singleton.reserved`       | Declared singleton name collides with a reserved root name   |
| `mosaic.singleton.missing`        | Declared singleton has no file at the site root              |
| `mosaic.redirect.loop`            | Redirect rules form a cycle                                  |
| `mosaic.redirect.collision`       | Redirect `from` collides with a real route                   |
| `mosaic.redirect.duplicate-from`  | Two redirect rules share the same `from`                     |
| `mosaic.ref.malformed`            | Ref string violates the ref grammar                          |

### Drift

| Code                          | Meaning                                                          |
|-------------------------------|------------------------------------------------------------------|
| `mosaic.field.required`       | A required field is missing from a record (after applying title precedence) |
| `mosaic.field.unknown`        | A record carries a field not declared in its type                |
| `mosaic.field.type-mismatch`  | A field's value does not match its declared type                 |
| `mosaic.ref.unresolved`       | A `ref:` or `asset:` target does not exist                       |
| `mosaic.selector.unresolved`  | A `@selector` does not resolve in the target                     |

### Warnings

| Code                              | Meaning                                                          |
|-----------------------------------|------------------------------------------------------------------|
| `mosaic.title.dead-h1`            | Markdown H1 present alongside JSON `title`                       |
| `mosaic.asset.orphan`             | Asset in `images/` referenced nowhere                            |
| `mosaic.asset.unmanifested`       | Asset on disk but not listed in `images/manifest.json`           |
| `mosaic.collection.unmounted`     | Collection has no mounting page and no inbound refs              |
| `mosaic.redirect.duplicate-source` | Both `mosaic.json#redirects` and a `redirects` singleton exist  |
| `mosaic.tokens.duplicate-source`  | Both `mosaic.json#tokens` and a `tokens` singleton exist         |
