# @mosaic/render-ref

Reference implementation of a wireframe renderer for Mosaic 0.8 sites. Zero
dependencies, plain Node.js (>= 18).

This is a *reference* renderer: correctness over polish. It produces basic,
readable HTML — enough to verify that a site's content, routing, refs, and
tokens are wired up correctly. It is not a production static-site generator.

## What it does

1. Loads a Mosaic site folder.
2. Builds an in-memory index per [SPEC §7](../../../spec/SPEC.md#7-the-index).
3. If structural diagnostics exist, exits 1 without writing any output.
4. Otherwise, emits HTML, CSS, and copied assets to the output directory:
   - one HTML file per page route (`<out>/<path>/index.html`)
   - one HTML file per routed collection record
   - one HTML file per redirect (`<meta http-equiv="refresh">` + JS fallback)
   - `_tokens.css` from the `tokens` singleton (or inline manifest tokens),
     emitted as CSS custom properties on `:root` per the DTCG flatten rule
   - `_styles.css` — a small default stylesheet that consumes those tokens
   - assets copied verbatim from `images/` and from any folder-shape record
     that contains image files (so `./photo.jpg` refs work)

## Usage

```sh
node render.js --site <path> --out <path> [--base <prefix>]
```

- `--site <path>` — path to a Mosaic site folder containing `mosaic.json`.
- `--out <path>` — output directory (created if missing; merged into if exists).
- `--base <prefix>` — optional URL prefix. With `--base /myproj`, all links
  emitted in the rendered HTML are prefixed with `/myproj`. Useful when the
  output is served under a sub-path.

Without `--base`, all links are emitted as **page-relative** paths (e.g.
`../../about` from `/team/anna/index.html`) so the site can be browsed
directly from `file://` without a web server.

## Exit codes

- `0` — render succeeded.
- `1` — structural diagnostics reported; nothing was written.
- `2` — bad arguments or missing site path.

Non-structural diagnostics (drift, warnings) are printed to stderr but do not
block rendering.

## Section types

The renderer dispatches on `type` for each entry in a page's `sections` array.
Recognised types:

| Type | Rendering |
|---|---|
| `collection-list` | `<ul class="collection-list">` with one `<li>` per record. Honours `sort` and `limit`. Links to record URLs when `routes` is not `false`. |
| `hero` | `<section class="hero">` with headline, subhead, image, CTA. |
| `prose` | `<section class="prose">` with the markdown at `from:` rendered inline. The leading H1, if present, is stripped to avoid duplicating the page title. |
| `page-intro` | `<section class="page-intro">` with headline + lede. |
| `feature-grid` | `<section class="feature-grid">` with one card per item. |
| `stat-grid` | `<section class="stat-grid">` with one cell per item. |
| `cta` | `<section class="cta">` with headline, body, button. |
| `contact-block` | `<section class="contact-block">` with a `<dl>` of fields. |
| `form` | `<form>` with inputs from the `fields` array. |
| `definition-list` | `<dl>` of term/definition pairs. |
| `pull-quote` | `<blockquote>` with attribution. |
| `principles` | `<ol>` of inline items or items resolved from `from:`. |
| (anything else) | `<section data-type="...">` with a generic `<dl>` field dump. |

For pages with both a markdown body and a `sections` array, the markdown body
is *not* rendered at page level — section rendering owns the page (a `prose`
section typically embeds the same markdown). Pages with no `sections` have
their markdown body rendered inline.

## Refs

The renderer materialises every ref it encounters, walking the index's
singletons, collections, and assets. Per SPEC §5 the index stores stubs; this
renderer follows them on demand to produce links, image tags, and inlined
values.

- `ref:<name>` → resolves to a singleton record; renders the title (and URL
  if available) as a link.
- `ref:<collection>/<slug>` → resolves to a collection record; renders the
  resolved title as a link to the record's URL.
- `ref:<addr>@<selector>` → JSON path first, then markdown heading. For the
  `tokens` singleton, the resolved DTCG value's `$value` field is unwrapped
  per [SPEC §10.3](../../../spec/SPEC.md#103-referring-to-tokens).
- `asset:<path>` → renders an `<img>` for image MIME types (or extensions),
  otherwise an `<a>` link. Pulls width/height/alt from `images/manifest.json`.
- `./<path>` → relative to the JSON file containing the ref. Markdown files
  load as prose; JSON files load as values; images render as `<img>`.

When a ref cannot be resolved, the renderer emits the original string wrapped
in `<span class="mosaic-unresolved">` rather than crashing.

## Tokens

If a `tokens` singleton exists (or `mosaic.json#tokens` is set), the renderer
flattens the DTCG payload into CSS custom properties:

```
color.background      → --color-background
color.accent.press    → --color-accent-press
font.size.base        → --font-size-base
```

`_styles.css` references these via `var(--name, fallback)` so it works with
both flat and nested token hierarchies.

## Redirects

Every entry in the route table with `kind: "redirect"` produces an HTML file
at the `from` path with:

- `<meta http-equiv="refresh" content="0; url=...">`
- `<link rel="canonical">`
- `<!-- mosaic:redirect status="..." location="..." -->` for tooling
- A `<script>window.location.replace("...")</script>` fallback

The automatic `/home → /` redirect is always emitted unless an explicit
redirect with `from: "/home"` exists.

## URL convention

Each route renders to `<out>/<segments>/index.html`. The home page is
`<out>/index.html`. This means links work both via a server (paths) and via
`file://` (the renderer rewrites root-relative URLs into page-relative when
`--base` is unset).

## Known limitations

- The markdown subset is intentionally small: headings, paragraphs, `*italic*`,
  `**bold**`, `[link](url)`, `- lists`, `> blockquotes`, ` ```fenced code``` `,
  and inline `code`. No tables, footnotes, autolinks, or HTML passthrough.
- The renderer does not perform drift/warning validation. It performs only
  enough structural validation to refuse a broken site (missing manifest,
  malformed slugs, route collisions, missing singletons, redirect loops).
  Use the dedicated validator for complete diagnostics.
- Engine-specific custom section types fall through to a generic field-dump
  renderer. They render, but they don't look pretty.
- `defaultSort` from `mosaic.json#collections` is honoured when a
  `collection-list` omits its own `sort`. `defaultMount` is informational
  only — pages still drive routing.
- Assets co-located with folder-shape records are copied to a path mirroring
  the source layout (`<out>/collections/team/anna/photo.jpg`). The rendered
  HTML uses URLs matching that layout. This is good enough for wireframe
  preview but is not a production URL strategy.

## File layout

```
impl/
  render.js              CLI entry
  package.json
  README.md              this file
  lib/
    build-index.js       in-memory index (subset of SPEC §7.2)
    diagnostics.js       diagnostic accumulator (mirrors the validator)
    html.js              escape + template helpers
    markdown.js          tiny markdown → HTML
    render-page.js       page + section rendering
    render-redirect.js   redirect HTML emission
    render-tokens.js     DTCG → CSS custom properties
    resolve-refs.js      ref / asset / relative / selector resolution
```
