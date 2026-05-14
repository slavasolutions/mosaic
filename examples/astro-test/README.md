# astro-test

Minimal Astro site that renders `examples/hromada-community` through `@mosaic/astro-adapter`.

Wireframe quality. The point is to prove the adapter pattern works end-to-end.

## Install

```
cd examples/astro-test
npm install
```

The adapter is linked locally (`file:../../tools/astro-adapter`).

## Develop

```
npm run dev
```

Astro will start on `http://localhost:4321`. Edit files under `../hromada-community/`; the page reloads.

## Build

```
npm run build
```

Output lands in `dist/`. Every Mosaic page URL and every collection-list record URL is statically pre-rendered.

## What's here

- `astro.config.mjs` — points the adapter at `../hromada-community`
- `src/pages/[...slug].astro` — the single catch-all that renders every Mosaic node (pages and records)
- `src/components/Section.astro` — dispatches on `section.type` to render hero / prose / collection-list / etc.
- `src/styles/tokens.css` — CSS custom properties derived from `tokens.json`

That's it. There is no Astro Content Collections config, no per-page templates — Mosaic owns the content shape, Astro owns the runtime.
