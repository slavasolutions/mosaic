# `mosaic init`

Scaffolds a fresh Mosaic site from a manifest.

## Usage

```
mosaic init [<path>] [--from <path-or-url>] [--name "<site-name>"] [--with-example]
```

- `<path>` — target directory (default: current).
- `--from <path>` — read the manifest from a local file or directory containing `mosaic.json`.
- `--from <url>` — fetch a manifest over HTTPS. The fetched JSON is the manifest.
- `--name` — override the manifest's `site.name` for the scaffolded folder.
- `--with-example` — also create one example collection (`news`) with one record.

If no `--from` is given, `init` looks for `mosaic.json` in the current directory; if absent, it writes a minimal one.

## Behavior

Per MIP-0008, `mosaic.json` is a full manifest. `init` reads it and realises it on disk.

1. **Load the manifest.** From `--from`, from the current directory, or synthesize a minimal one (`version`, `site.name`, empty `types`/`collections`/`singletons`/`redirects`).
2. **Create the target directory** (default: current). Refuses to overwrite a non-empty directory unless explicitly allowed.
3. **Create core folders:** `pages/`, `collections/`, `images/`. There is no `globals/` directory in 0.8 — singletons live at the root (MIP-0007).
4. **Scaffold singletons.** For each entry in `mosaic.json#singletons`, create `<name>.json` at the site root, pre-populated with the bound type's default field values (empty string for `string`, `0` for `number`, `false` for `boolean`, `null` for `ref` and `asset`, `[]` for `array`, `{}` for `object`).
5. **Scaffold collections.** For each entry in `mosaic.json#collections`:
   - Create `collections/<name>/`.
   - If the entry declares `defaultMount`, also create a mounting page at `pages/<defaultMount-tail>.json` containing a `collection-list` section pointing at `collections/<name>`. If the collection declares `defaultSort`, the section uses that sort value.
6. **Scaffold tokens.** If `mosaic.json#singletons` declares a singleton named `tokens` of type `DesignTokens`, write a starter DTCG-shaped `tokens.json` at the root (color background/text/accent, font body/size-base).
7. **Write a home page.** `pages/index.md` with a starter greeting.
8. **With `--with-example`:** also create one `news` collection record and a `pages/news.json` mounting it (if not already produced by step 5).

## Examples

Scaffold an empty site:

```
mosaic init my-site --name "My Site"
```

Scaffold from a local template manifest:

```
mosaic init my-site --from ./templates/marketing/mosaic.json
```

Scaffold from a remote template manifest:

```
mosaic init my-site --from https://templates.mosaic.dev/marketing/mosaic.json
```

Exits `0` on success, `64+` on invocation errors (e.g. target exists and is not empty, manifest fetch fails, manifest invalid).
