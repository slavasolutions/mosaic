# `@mosaic/migrate-interactive`

Step-by-step CLI that walks an Astro site and emits Mosaic 0.8 shape.

This is the **interactive** companion to the static guide in `tools/migrate/astro/README.md`. The static guide tells a human what to do by hand. This tool does the walking, classifies what it finds, proposes mappings, asks the user to confirm, and writes the output.

Zero dependencies. Pure Node stdlib (`node:fs`, `node:path`, `node:readline`).

## Install

Nothing to install. The tool runs directly:

```bash
node tools/migrate/interactive/migrate.js --help
```

## Usage

```bash
node tools/migrate/interactive/migrate.js \
  --source <path-to-astro-site> \
  --out    <path-to-mosaic-output> \
  [--yes] [--dry-run] [--config <file>] [--force]
```

| Flag        | Description |
|-------------|-------------|
| `--source`  | Path to the Astro project root (`astro.config.mjs` lives here). |
| `--out`     | Path to the Mosaic output. Created if missing. Refuses to write into a non-empty directory unless `--force`. |
| `--yes`     | Accept all proposed defaults non-interactively (good for CI and re-runs). |
| `--dry-run` | Show the plan; write nothing. |
| `--config`  | Load previously-saved decisions JSON (a `.mosaic-migration-decisions.json` written by an earlier run). |
| `--force`   | Overwrite an existing non-empty `<out>`. |

After every interactive run, the tool writes `<out>/.mosaic-migration-decisions.json` so the migration can be re-run reproducibly with `--config`.

## What it does, in ten phases

Each phase pauses for confirmation in interactive mode. `--yes` skips the prompts and takes the default for every decision.

| Phase | What |
|-------|------|
| 1     | Scan source. Report pages, collections, public assets, components, layouts, inlang/paraglide presence. |
| 2     | Site identity. Read `astro.config.mjs` `site:` block + `package.json#name`; propose `mosaic.json#site`. |
| 3     | Pages. For each `src/pages/*.{astro,md,mdx}`, propose `pages/<slug>.{json,md}`. Astro template-only pages get a JSON stub with sections=[] and `$astro.source` pointing at the original file. |
| 4     | Collections. For each `src/content/<name>/`, infer a type by sampling field names + values across records; emit `mosaic.json#types#<Name>` and `mosaic.json#collections#<name>`. |
| 5     | Messages. If `project.inlang/settings.json` or `messages/<locale>.json` files exist, bundle every locale into a single `messages.json` singleton bound to a free-form `Messages` type. |
| 6     | Singletons. Emit `site.json`, `header.json`, `footer.json`, `meta.json`. Header nav is auto-derived from inlang `nav_*` message keys when available. |
| 7     | Assets. Copy `public/<image>` → `images/<image>`, generate `images/manifest.json`. Ask before copying files >5MB. Non-image public files go to `_astro-public/` (underscore-prefixed, so Mosaic ignores them; the engine can still serve them at build time). |
| 8     | Redirects. Lift `astro.config.mjs` `redirects:` into `mosaic.json#redirects`. Skips Astro dynamic patterns (`[...slug]`) — they aren't representable in Mosaic 0.8. |
| 9     | Engine-extension preservation. Per MIP-0009: anything the migrator couldn't map cleanly (unknown frontmatter, localized field maps, alternate-locale markdown bodies) goes under `$astro.*` on the record. |
| 10    | Write. Emit `mosaic.json`, page records, collection records, singletons, assets, manifest. Save `.mosaic-migration-decisions.json`. |

## What it does NOT do

- **Multi-locale routing.** Mosaic 0.8 is single-locale per site. The migrator picks the source's `baseLocale` and surfaces alternate-locale text under `$astro.localized` / `$astro.translations` for future per-locale forks (one Mosaic site per locale) or engine-side handling. Per the brief, multi-locale is a 0.9 problem.
- **Astro template logic.** `.astro` pages contain JSX-like component compositions that aren't content. The migrator emits a JSON page stub with empty sections and a `$astro.source` pointer so a renderer or engine extension can wire them up later.
- **MDX components.** Mosaic 0.8 doesn't support MDX. Bodies with import statements are migrated as-is (they will fail to render as plain markdown until you clean them up by hand).
- **Component-level migration.** `src/components/` and `src/layouts/` are reported as counts only and not migrated.

## Output shape

```
<out>/
  mosaic.json
  pages/
    index.json
    <each top-level page>.json
    <each collection-mount page>.json
  collections/
    <name>/
      <slug>.json     (data fields, plus optional $astro stash)
      <slug>.md       (markdown body, frontmatter-free)
  images/
    manifest.json
    <copied image files...>
  _astro-public/      (non-image public assets, ignored by Mosaic)
    documents/
    fonts/
  site.json
  header.json
  footer.json
  meta.json
  messages.json
  .mosaic-migration-decisions.json
```

## Test it

The repo includes a real-world target: the user's `clear-ucc-ref` Astro+inlang site at `/home/ms/clear-ucc-ref/` (read-only).

```bash
node tools/migrate/interactive/migrate.js \
  --source /home/ms/clear-ucc-ref \
  --out    /home/ms/mosaic-clear-ucc-migrated \
  --yes
```

Then validate:

```bash
node tools/validate/impl/validate.js \
  --site /home/ms/mosaic-clear-ucc-migrated --human
```

## Constraints

- **Zero deps.** Node stdlib only — no `marked`, no `chalk`, no `inquirer`.
- **Never writes inside `--source`.** The tool refuses if `--out` is the same as or nested under `--source`.
- **Idempotent.** `--yes --config <prior-run>` produces the same output every time.
- **Honest about gaps.** Anything the migrator can't map cleanly is surfaced as a `skipped` note in the report or stashed under `$astro.*` on the record (never silently lost).
