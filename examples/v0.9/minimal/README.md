# minimal

The smallest legal Mosaic 0.9 site.

## What this tests

- `mosaic.json` at root identifies the folder as a Mosaic site
- `pages/index.md` resolves to URL `/`
- A bare markdown file (no JSON sidecar) works as engine charity
- Title falls back to the first H1 in the markdown body
- No singletons, no collections, no tokens, no extensions

## Expected route table

- `/` → `pages/index.md` (title: "Hello")

## Expected diagnostics

- `mosaic.md.bare` (warning) emitted for `pages/index.md` — bare MD file with no JSON sidecar. Engine charity allowed; warning surfaces the convention.

## Rules exercised

- `mosaic.json` is the only reserved file
- `pages/` is conventionally routed
- Markdown body auto-links to same-slug JSON IF JSON has no body field; here there is no JSON at all, so the body stands alone
- Title precedence: no JSON title → first H1 wins
