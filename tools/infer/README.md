# `mosaic infer`

Walks a folder of content and produces a draft `mosaic.json` from what it sees. A migration aid, not a daily-use tool.

## Usage

```
mosaic infer [--site <path>] [--out <path>] [--overwrite]
```

## Behavior

1. Walks `pages/`, `collections/`, and root-level singleton files (per MIP-0007, singletons live at the site root, not under `globals/`).
2. For each collection, samples records and infers a type:
   - Field name = JSON key (markdown body becomes a `body` field of type `markdown`).
   - Field type = inferred from value (`string`, `number`, `boolean`, `date` (ISO 8601 strings that parse), `ref` (strings starting with `ref:`), `asset` (`asset:` or `./` paths to images), `array`, `object`).
   - For inferred `ref` fields, the target is detected by the first-`/` rule (SPEC §5.3): no `/` in the address → singleton; one `/` → `<collection>/<slug>`. The `to` is set accordingly.
   - A field is marked `required: true` only if it appears in every record sampled.
3. For each root-level singleton file, declares an entry in `mosaic.json#singletons` and creates a matching type.
4. Writes `mosaic.json` to the site root (or `--out`). Refuses to overwrite without `--overwrite`.
5. Adds `"$mosaic.inferred": true` to the top of the file so future runs can tell hand-edited from generated. The `$mosaic.*` prefix is the conventional namespace for tool-authored metadata per MIP-0009.

## Caveats

- Inference is heuristic. A field that's actually optional but happens to appear in every sampled record will be flagged required. Authors should review the output.
- Custom types are not detected; everything becomes a fresh type named after its collection or singleton.
- Run `mosaic validate` afterward and clean up false positives.

## When to use

- During migration from a non-Mosaic source where you don't yet have a schema.
- After a manual content dump, to bootstrap a schema you can edit.

Not intended as part of a normal workflow. Schemas should be hand-maintained after the first draft.
