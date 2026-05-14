# `mosaic validate`

Walks a Mosaic site and reports structural errors, drift, and warnings per SPEC §7.

## Usage

```
mosaic validate [--site <path>] [--strict] [--json] [--quiet]
```

## Behavior

1. Load `mosaic.json`. If missing or malformed, emit `mosaic.config.invalid` and exit `1`.
2. Run the resolution algorithm (SPEC §8.1) steps 1–7. Do not emit the index.
3. Collect diagnostics. Print them grouped by severity.
4. Exit `0` if no structural errors. Exit `1` if structural errors. Exit `2` if drift present *and* `--strict` was set.

## Output (human)

```
Mosaic 0.7 site: ./examples/hromada-community

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
  "version": "0.7",
  "diagnostics": [
    { "severity": "drift", "code": "mosaic.ref.unresolved", "source": "...", "message": "..." }
  ],
  "summary": { "structural": 0, "drift": 2, "warning": 1 }
}
```

## Error codes (selected)

| Code                          | Meaning                                              |
|-------------------------------|------------------------------------------------------|
| `mosaic.config.invalid`       | `mosaic.json` missing, unparseable, or schema-invalid |
| `mosaic.slug.invalid`         | Filename does not match slug regex                   |
| `mosaic.record.empty`         | Record has neither markdown nor JSON                 |
| `mosaic.route.collision`      | Two pages or mounts claim the same URL               |
| `mosaic.collection.missing`   | `collection-list` references a non-existent path     |
| `mosaic.ref.unresolved`       | A `ref:` or `asset:` target does not exist           |
| `mosaic.selector.unresolved`  | A `@selector` does not match the target              |
| `mosaic.relative.invalid`     | A `./` ref used in a markdown-only record            |
| `mosaic.field.required`       | A schema-required field is missing from a record     |
| `mosaic.field.unknown`        | A record carries a field not in its type             |
| `mosaic.field.type-mismatch`  | A field's value does not match its declared type     |
| `mosaic.title.dead-h1`        | Markdown H1 present alongside JSON `title` (warning) |
| `mosaic.asset.orphan`         | Asset in `images/` not referenced anywhere (warning) |
| `mosaic.collection.unmounted` | Collection has no mounting page, no inbound refs (warning) |
