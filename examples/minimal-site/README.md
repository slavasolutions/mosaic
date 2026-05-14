# minimal-site

The smallest valid Mosaic 0.8 site. One manifest, one page, nothing else.

## What's here

```
minimal-site/
├── mosaic.json     manifest (spec §1.1, §8)
├── README.md       this file
└── pages/
    └── index.md    the home page (spec §1.2, §3.1, §3.2)
```

## What each file does

- **`mosaic.json`** — declares the site identity (`name`) and the spec version (`0.8`). The four top-level structural fields (`site`, `types`, `collections`, `singletons`) are all required by SPEC §8.1, but each MAY be empty. Optional fields (`redirects`, `tokens`) are omitted entirely.
- **`pages/index.md`** — a single markdown-only record (SPEC §2.1). Per SPEC §3.1 and §3.2, `pages/index.md` mints the home route `/`. The title resolves to `"Hello"` via the markdown H1 (SPEC §2.3).
- No frontmatter anywhere (SPEC §2.4, T4).

## What's intentionally missing

- No `collections/` directory. The manifest declares zero collections, so none is needed on disk. (The required `collections` key in `mosaic.json` is the empty object `{}`.)
- No singleton files at the root. The manifest declares zero singletons.
- No `images/` directory and no assets.
- No `types`, `redirects`, or `tokens`.
- No JSON sidecar for the home page — markdown alone is a valid record.

## Truths this example exercises

- **T1** — The folder is the website. Three files, on disk, are the whole thing.
- **T2** — A site has five things; this one uses two of them (manifest, one page).
- **T3** — A record is markdown, JSON, or both; this uses markdown-only.
- **T4** — Frontmatter is forbidden.
- **T14** — Spec version is declared in `mosaic.json#version`.
- **T17** — Home is `/`. `pages/index.md` mints it.

## Validating

The manifest validates against `mosaic.schema.json` as JSON Schema 2020-12:

```
npx -y ajv-cli@5 validate \
  -s ../../mosaic.schema.json \
  --spec=draft2020 \
  -d mosaic.json
```
