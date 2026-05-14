# `mosaic index`

Produces a derived index from a site. The index shape is normative (SPEC §8); storage is not.

## Usage

```
mosaic index [--site <path>] [--out <path>] [--format json|sqlite]
```

## Behavior

1. Run validation (SPEC §8.1, steps 1–7).
2. If any structural errors, exit `1` without producing output.
3. Otherwise, emit the index in the requested format.
4. Drift and warnings still appear on stderr; they do not block emission.

## Formats

- `--format json` (default): single JSON document conforming to SPEC §8.
- `--format sqlite`: a SQLite database with one table per top-level key (`pages`, `collections`, `globals`, `routes`, `assets`, `diagnostics`). Schema documented separately.

## Output destinations

- `--out -` (default): stdout for JSON, error for sqlite.
- `--out <file>`: write to file. For sqlite, the file is the database.
- `--out <dir>/`: write `index.json` or `index.db` into the directory.

## Why this exists

Engines often want to reimplement the walk in their own runtime. This tool exists for:

- Debugging ("what does Mosaic *see* in my folder?")
- Agents and editors that want a queryable view without a full engine
- CI pipelines that want a single artifact to diff between builds
