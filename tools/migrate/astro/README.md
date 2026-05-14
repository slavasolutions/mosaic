# Astro → Mosaic migration

Step-by-step for converting an Astro site (especially one using Content Collections) into Mosaic 0.8 shape.

## Before you start

You'll need:

- A copy of the Astro site (do not migrate in-place).
- Read access to `src/content/`, `src/pages/`, `public/`, and `src/content/config.ts` if it exists.
- The validator (`mosaic validate`) ready to run.

## Step 1 — Lay out the target folder

```
mosaic-site/
├── mosaic.json     (will be generated in step 4)
├── pages/
├── collections/
└── images/
```

(Singletons such as `site.json`, `header.json`, `footer.json` live at the **site root**, not in a `globals/` directory — per MIP-0007.)

## Step 2 — Move pages

For each file in `src/pages/`:

| Astro file              | Action                                                                  |
|-------------------------|-------------------------------------------------------------------------|
| `index.md` or `index.mdx` | Copy to `pages/index.md`. Strip frontmatter into `pages/index.json` if it has structured fields beyond `title`. |
| `about.md`              | Copy to `pages/about.md`. Same frontmatter handling.                    |
| `about.astro`           | This is a templated layout, not content. Decide: is it a page (write a `pages/about.json` with sections describing the layout) or is it template logic (lives in your engine, not in content)? |
| `[slug].astro` / `[...slug].astro` | These are dynamic routes backed by collections. Don't migrate the route file itself; migrate the collection it pulls from (step 3) and create a `pages/<name>.json` that mounts it with `collection-list`. |
| `posts/index.astro` (list page) | Becomes `pages/posts.json` with a `collection-list` section.    |

## Step 3 — Move collections

For each collection in `src/content/<name>/`:

1. `mkdir -p collections/<name>/`
2. For each entry:
   - If the entry is `<slug>.md` or `<slug>.mdx`:
     - Parse the frontmatter.
     - Write the body (no frontmatter) to `collections/<name>/<slug>.md`.
     - Write the parsed fields to `collections/<name>/<slug>.json`.
     - If the entry only has frontmatter and no body, write JSON only.
   - If the entry uses an MDX component import or anything not pure markdown, decide: convert to plain markdown (lossy) or render to HTML and store the result (also lossy). Mosaic 0.7 does not support MDX.

## Step 4 — Convert the schema

If `src/content/config.ts` exists with Zod schemas:

For each `defineCollection({ schema: z.object({ ... }) })`:

1. Translate the Zod object into a Mosaic type. Mapping:

| Zod                       | Mosaic field type                       |
|---------------------------|-----------------------------------------|
| `z.string()`              | `string`                                |
| `z.number()`              | `number`                                |
| `z.boolean()`             | `boolean`                               |
| `z.date()` or `z.coerce.date()` | `date`                            |
| `z.array(X)`              | `array` with `of: <X>`                  |
| `z.object({...})`         | `object`                                |
| `z.literal('...')`        | `string` (literal validation is non-normative in 0.7) |
| `reference('other')`      | `ref`                                   |
| `image()`                 | `asset`                                 |
| `.optional()`             | omit `required`                         |
| no `.optional()`          | `required: true`                        |

2. Add the type to `mosaic.json` under `types`.
3. Bind it: `"collections": { "<name>": { "type": "<TypeName>" } }`.

Alternatively, skip the manual translation: run `mosaic infer` after step 3 and let it generate a draft, then hand-edit to match what Zod said.

## Step 5 — Convert singletons

Astro sites typically don't have a formal "singletons" concept; site-wide data is usually in:

- A config file (`src/config.ts`, `astro.config.mjs`'s `site`)
- A layout component
- Sometimes a single content entry like `src/content/site/info.md`

For each piece of site-wide data, write it as `<name>.json` at the example root. Common singletons: `site.json`, `header.json`, `footer.json`. Each must also be declared in `mosaic.json#singletons` and bound to a type.

Move any Astro layout that references site-wide data so its references become `ref:site@<field>` in Mosaic (no `globals/` prefix — singletons are addressed by bare name; the first-`/` rule disambiguates them from collections).

## Step 6 — Move assets

```
public/  →  images/  (just the images; non-image assets stay out of Mosaic's scope)
```

Then write `images/manifest.json`. You can generate this with a quick script: walk `images/`, for each image record `{ width, height, alt: "" }`. Hand-fill `alt` where you have it.

## Step 7 — Rewrite links

Astro markdown often uses relative links like `[about](../about)` or absolute `[about](/about)`. Mosaic supports both URL links (just leave them) and `ref:` references.

You only need to rewrite to `ref:` if:

- The link is to a record where the URL might change.
- You want the link to survive a route refactor.
- The link is to a global or selector.

For a first migration, leave URL links alone. They'll keep working. Migrate to `ref:` later if it pays off.

## Step 8 — Validate

```
mosaic validate --site mosaic-site/
```

Expect drift on the first pass:

- Required fields you forgot to bring over → `mosaic.field.required`
- Refs pointing at slugs that didn't make it → `mosaic.ref.unresolved`
- Frontmatter you missed stripping → no specific code; the field just won't appear because Mosaic doesn't parse frontmatter

Fix structural errors first (they block index emission). Fix drift next. Warnings can wait.

## Step 9 — Spot-check

Run `mosaic index --site mosaic-site/ --out -` and compare the route table to Astro's `npm run build` output. They should agree on every URL that's content (not template logic).

## Common gotchas

- **`title` in frontmatter and `# Title` in markdown.** Both Astro and Mosaic prefer the frontmatter/JSON title. Mosaic flags the dead H1 as a warning. Just drop one.
- **MDX components.** Mosaic doesn't support them. Either convert to plain markdown or render to HTML and store the result.
- **Slug case.** Astro tolerates `MyPost.md`; Mosaic requires lowercase. Rename during migration.
- **Date-prefixed slugs.** Astro often uses `2024-01-15-post.md`. Mosaic does not parse dates from filenames; put the `date` in the JSON sidecar.
- **`redirect_from` in frontmatter.** Some Astro setups (and migrators from Jekyll/Hugo) carry per-page `redirect_from` arrays. Lift these into `mosaic.json#redirects` as `{ "from": "<old>", "to": "<new>", "status": 301 }` entries.
- **`pages/home.*`.** Reserved in 0.8. If the source has both `pages/index` and `pages/home`, fold `home` into `index` (or rename to a non-reserved slug). Engines auto-redirect `/home → /` regardless.
