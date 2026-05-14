# `mosaic init`

Scaffolds a fresh Mosaic site.

## Usage

```
mosaic init [<path>] [--name "<site-name>"] [--with-example]
```

## Behavior

1. Creates the target directory (default: current).
2. Writes `mosaic.json` with a minimal `version`, `site.name`, and empty `types`/`collections`/`globals`.
3. Creates empty `pages/`, `collections/`, `globals/`, `images/`.
4. Writes a starter `pages/index.md` with a greeting.
5. With `--with-example`, also creates one collection (`news`) with one record, and a `pages/news.json` mounting it.

Exits `0` on success, `64+` on invocation errors (e.g. target exists and is not empty).
