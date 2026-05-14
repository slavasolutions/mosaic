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
2. **Map content.** For each piece of content, decide: page, collection record, or global?
3. **Convert files.** Translate the source's structured-data channel (Astro frontmatter, JSON sidecar, custom YAML, whatever) into Mosaic JSON sidecars. Markdown body stays markdown.
4. **Build `mosaic.json`.** Either run `mosaic infer` to bootstrap, or hand-write.
5. **Map links.** Internal cross-references in the source become `ref:` refs in Mosaic.
6. **Move assets.** Images go into `images/`. Build the manifest.
7. **Validate.** Run `mosaic validate`. Fix structural errors. Note drift.
8. **Spot-check routes.** Run `mosaic index` and inspect the route table against what the source produced.

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

## Frontmatter conversion

Astro stores structured fields in YAML frontmatter; Mosaic forbids frontmatter (SPEC §3.3). For each source markdown file:

1. Parse the frontmatter.
2. Write a JSON sidecar with the parsed fields.
3. Rewrite the markdown to remove the frontmatter block.
4. If the frontmatter `title` matches the first H1, drop one of them (JSON wins per spec).
