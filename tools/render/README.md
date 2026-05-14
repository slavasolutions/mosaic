# `mosaic render`

Takes a Mosaic site and emits a basic HTML site to an output directory. This is the **reference wireframe renderer** — readable but unstyled, useful for proofing content during authoring and as a starting point for engine authors who want to see what "minimally rendered Mosaic" looks like.

It is not a production renderer. Serious engines (Astro, Next, custom) read the index directly.

## Usage

```
mosaic render [--site <path>] [--out <path>] [--base <prefix>]
```

- `--site <path>` — site root. Defaults to the current directory.
- `--out <path>` — output directory. Defaults to `./_site/`.
- `--base <prefix>` — URL prefix prepended to every emitted link (useful when the site is hosted under a subpath).

## Behavior

1. **Validate first.** Runs `mosaic validate` in-process. If any structural diagnostic is reported, refuses to render and exits `1`. Drift and warnings do not block rendering.
2. **Emit pages.** One HTML file per routed page or record. URL → output path mapping follows SPEC §3.1, with `.html` appended.
3. **Emit redirect placeholders.** One HTML file per redirect rule in the index, containing a `<meta http-equiv="refresh">` tag pointing at the target. The HTTP `Location:` header that a real server would emit is included as an HTML comment hint near the top of the file (`<!-- Location: /news -->`), so deploy-time scripts can lift the redirect into server config if desired.
4. **Emit tokens.** If a `tokens` singleton (or inline `mosaic.json#tokens` payload) is present, walk the DTCG tree and emit `_tokens.css` with each leaf as a CSS custom property on `:root` (e.g. `--color-accent: #0066cc;`). The token file is `<link rel="stylesheet">`-included from every emitted page.
5. **Emit a default stylesheet.** A minimal `_styles.css` covering typography, lists, and the wireframe `<section>` boxes.
6. **Home is `/`.** The home page lives at `<out>/index.html`. There is no `<out>/home/index.html`; instead, `<out>/home.html` is a redirect placeholder for `/home → /` (SPEC §3.2). This mirrors the automatic redirect that native engines apply server-side.
7. **Resolve ref stubs in the index.** Stubs (SPEC §5.8) carry `url` and `title`. The wireframe renderer uses both to emit `<a href="{url}">{title}</a>`. Unrouted-target stubs (`url: null`) render as plain text with the resolved title.
8. **Custom sections.** Anything other than `collection-list` is rendered as a wireframe block:

   ```html
   <section data-type="hero">
     <dl>
       <dt>heading</dt><dd>Welcome</dd>
       <dt>image</dt><dd><img src="/images/hero.jpg" alt="..."></dd>
     </dl>
   </section>
   ```

   Authors who want richer output write their own renderer or use a real engine.

## Output shape

For a small example site, `<out>/` looks like:

```
index.html
about.html
news.html
news/2025-03-12-launch.html
home.html        (the /home → / placeholder redirect)
_tokens.css      (DTCG → CSS variables, if tokens singleton present)
_styles.css      (minimal default styles)
```

Underscored filenames (`_tokens.css`, `_styles.css`) are convention; they sort to the top of directory listings and are clearly tool-owned. Authors should not edit them by hand — re-rendering overwrites them.

## Exit codes

- `0` — render succeeded.
- `1` — render refused because validation produced structural errors.
- `64+` — invocation error (missing `--site`, output path unwritable, etc.).

## Reference implementation

A reference implementation lives at `tools/render/impl/`. It is intentionally small and readable; engine authors are encouraged to read it as a worked example of "how to walk the index".
