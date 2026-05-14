# `mosaic migrate`

Converts a non-Mosaic content folder into Mosaic shape. Inherently source-specific — one migrator per source format.

## What this directory contains

Per-source guides and reference scripts. Each subdirectory targets one source:

- `astro/` — Astro Content Collections (`src/content/`)
- `markdown-folder/` — bare folder of `.md` files with frontmatter
- *(others as needed)*

## Universal migration workflow

Regardless of source, the steps are the same:

1. **Copy.** Never migrate in-place. Work on a copy.
2. **Map content.** For each piece of content, decide: page, collection record, or singleton? Singletons live as `<name>.{json,md}` at the **site root**, not under a `globals/` directory (per MIP-0007).
3. **Convert files.** Translate the source's structured-data channel (Astro frontmatter, JSON sidecar, custom YAML, whatever) into Mosaic JSON sidecars. Markdown body stays markdown.
4. **Build `mosaic.json`.** Either run `mosaic infer` to bootstrap, or hand-write. The manifest declares `singletons` (not `globals`) and may declare `redirects` and `tokens` (per MIP-0008).
5. **Map links.** Internal cross-references in the source become `ref:` refs in Mosaic. Singleton refs drop the old `globals/` prefix: `ref:site` (not `ref:globals/site`).
6. **Move assets.** Images go into `images/`. Build the manifest.
7. **Lift redirects.** If the source ships an URL-rewrite list or per-page `redirect_from` style fields, fold them into `mosaic.json#redirects`.
8. **Validate.** Run `mosaic validate`. Fix structural errors. Note drift.
9. **Spot-check routes.** Run `mosaic index` and inspect the route table against what the source produced.

## Astro-specific notes

See `astro/README.md` for the full guide. Quick summary:

| Astro                                | Mosaic                                                |
|--------------------------------------|-------------------------------------------------------|
| `src/pages/*.astro`                  | `pages/*.json` (sections describe layout) + `.md` for prose |
| `src/pages/*.md` or `*.mdx`          | `pages/*.md`                                          |
| `src/content/<collection>/*.md`      | `collections/<collection>/*.md` (+ `.json` sidecar)   |
| `src/content/config.ts` (Zod schemas) | `mosaic.json` types                                  |
| Frontmatter fields                   | JSON sidecar fields                                   |
| `public/*` (images)                  | `images/*` (+ `manifest.json`)                        |
| Internal Markdown links              | `ref:` refs                                           |
| 0.7 `globals/<name>.json`            | `<name>.json` at the site root (per MIP-0007)         |
| Per-page `redirect_from` frontmatter | Entries in `mosaic.json#redirects`                    |

## Frontmatter conversion

Astro stores structured fields in YAML frontmatter; Mosaic forbids frontmatter (SPEC §2.4). For each source markdown file:

1. Parse the frontmatter.
2. Write a JSON sidecar with the parsed fields.
3. Rewrite the markdown to remove the frontmatter block.
4. If the frontmatter `title` matches the first H1, drop one of them (JSON wins per spec).
