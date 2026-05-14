# Mosaic 0.8 — overnight build report

**Status:** ready for your review.
**Branch:** `v0.8-draft` on `slavasolutions/mosaic`.
**Reachable at:** https://github.com/slavasolutions/mosaic/tree/v0.8-draft
**Local working copy:** `/home/ms/mosaic-0.7/mosaic-spec/` (folder name is historical; content is 0.8).

---

## What landed

### Foundations
- `TRUTHS.md` — 17 axioms. **Read this first.**
- `spec/SPEC.md` — full 0.8 rewrite. 11 sections + the §8.3.1 free-form-type escape hatch.
- `mosaic.schema.json` — real JSON Schema 2020-12 (replaces the 0.7 vapor URL).
- `OVERVIEW.md` — one-page guided tour, linked from README.

### MIPs (7 new, all shipped 0.8)
- MIP-0007 Root-level singletons (replaces `globals/`).
- MIP-0008 `mosaic.json` as full manifest (`defaultSort`, `defaultMount`, redirects, tokens).
- MIP-0009 Writers preserve unknown fields (restored from 0.6).
- MIP-0010 Required-title uses the resolved value (closes 0.7 interop hole).
- MIP-0011 Design tokens as a root singleton (DTCG-aligned).
- MIP-0012 Redirects.
- MIP-0013 Home is `/`.

### Examples (all validate clean)
- `examples/minimal-site/` — smallest valid site. 3 files. 0 diagnostics.
- `examples/hromada-community/` — canonical site, migrated from 0.7. 0 structural, 0 drift, 5 dead-H1 warnings (intentional, demonstrate the rule).
- `examples/complex-site/` — Glasshouse Press fictional studio. 43 files. Exercises every 0.8 feature in one site. 0 structural, 0 drift, 3 dead-H1 warnings (intentional).
- `examples/astro-test/` — Astro project that builds the hromada site via `@mosaic/astro-adapter`. `npm install` + `npm run build` both pass. 19 HTML pages emitted including the auto `/home → /` redirect.

### Tooling (reference implementations)
- `tools/validate/impl/` — Node validator, ~1900 lines, zero deps. **31/32 conformance tests pass. 1 stub remains skipped.**
- `tools/render/impl/` — Node wireframe renderer, ~2450 lines, zero deps. Renders all 3 examples; tokens become CSS variables; auto `/home` redirect emitted as `<meta http-equiv="refresh">`.
- `tools/astro-adapter/` — Astro integration (`embedded mode` per SPEC §0.2). Re-implementation of the index walker (no cross-import from the validator; both are valid consumers of the same spec).
- `tools/{init,infer,migrate,migrate/astro,fix,index,render}/README.md` — all refreshed for 0.8.

### Conformance tests
- 31/32 pass against the reference validator.
- Coverage matches every section of SPEC §1–§7. Tests 026–032 added for the new MIPs.
- One stub remains (`018-relative-ref-in-md-only-fail`) — the rule it tests is degenerate (refs only appear in JSON; markdown-only records have no JSON; so the theoretical case requires construction that doesn't arise in normal authoring).

### Docs
- `docs/showcase.html` — 2017-line standalone visual showcase. No CDN, no fonts, no external assets. Dark-mode aware. Open in any browser.
- `README.md` — refreshed top-level pitch.
- `CHANGELOG.md` — 0.8 entry with breaking-change list from 0.7.

---

## Verification you can run yourself

```bash
cd /home/ms/mosaic-0.7/mosaic-spec

# Validate every example
node tools/validate/impl/validate.js --site examples/minimal-site --human
node tools/validate/impl/validate.js --site examples/hromada-community --human
node tools/validate/impl/validate.js --site examples/complex-site --human

# Run the conformance suite
node tests/runner/run.js --tool "node tools/validate/impl/validate.js"

# Render every example to HTML
node tools/render/impl/render.js --site examples/minimal-site --out /tmp/m-min
node tools/render/impl/render.js --site examples/hromada-community --out /tmp/m-hromada
node tools/render/impl/render.js --site examples/complex-site --out /tmp/m-complex
# Then open /tmp/m-hromada/index.html in a browser

# Run the Astro test app
cd examples/astro-test
npm install   # already installed
npm run build
# or npm run dev → http://localhost:4321

# Visual showcase
xdg-open docs/showcase.html   # or open in Firefox/Chrome directly
```

---

## Decisions made overnight you may want to revisit

### 1. The free-form type escape hatch
`spec/SPEC.md` §8.3.1 introduces: a type with empty `fields: {}` accepts any field on its records. Used by `DesignTokens` so the DTCG payload is opaque to Mosaic field-validation (per MIP-0011's "preserve verbatim" rule). Also: any field name prefixed with `$` (e.g. `$mosaic.inferred`, `$clearcms.translations`) is universally exempt from the unknown-field check, matching MIP-0009's engine-namespace convention.

**If you don't like this:** the alternative is to enumerate every DTCG group (`color`, `font`, `space`, `radius`, `shadow`) as fields in `DesignTokens`. Verbose but explicit.

### 2. `./` refs in direct (sidecar) records
SPEC §5.5 says "A relative ref in a markdown-only record has no defined 'here'." The validator initially over-read this as "only folder-shape records can use `./`." I reverted it: `./` is valid in any record JSON; the parent dir is the anchor for direct/sidecar records. Both examples (`pages/index.json` referencing `./index.md`) now validate clean. **This is the spec's wording; the over-strict reading was the validator agent's mistake.**

### 3. `mosaic.collection.unmounted` warning suppressed by default
SPEC §6.1 says warnings are "optional but RECOMMENDED." The default validator suppresses `collection.unmounted` since unrouted collections are blessed by §3.7. Test `025-unrouted-collection-pass` accepts both readings. A `--strict` flag would enable it (not implemented).

### 4. Renderer treatment of body + `prose` section
A record with both a markdown body and a JSON section list containing a `{type: "prose", from: "./index.md"}` section would otherwise duplicate the markdown. The renderer suppresses the body in that case and lets the section own the inlining. Spec is silent on this; the choice is documented in `tools/render/impl/README.md`.

### 5. Renderer's URL-to-file mapping
Every route becomes `<out>/<segments>/index.html`. Choice not in spec; it's renderer-defined per SPEC §3.1 (which specifies URL minting but not output layout). Mentioned in the renderer's README.

---

## Known unfinished

1. **`@mosaic/core` extraction.** Validator and Astro adapter each re-implement the walker/parser/resolver. Should factor into a shared core package. Follow-up PR.
2. **SQLite index format.** Documented at field level only; SQL schema not pinned.
3. **Property-based tests.** Empty `tests/property/` directory; no tests yet.
4. **Localization beyond `site.locale`.** Out of scope for 0.8. See "Localization plan" below.
5. **Renderer asset path handling for non-static hosting.** Asset stubs emit `images/<path>` URLs; in an Astro/Vercel build these would need to be copied into a public dir or routed through Astro's asset pipeline. The reference renderer works for `file://` browsing only; production-grade renderers will need real asset paths.
6. **One conformance stub** (`018-relative-ref-in-md-only-fail`) left because the rule it tests is degenerate.

---

## Localization plan (for clear-ucc migration)

clear-ucc uses inlang/paraglide for i18n. Mosaic 0.8 only supports `site.locale` (single-locale). For multi-locale migration, three options in order of pragmatism:

1. **One Mosaic site per locale** (works today, no spec changes): `mosaic-en/`, `mosaic-uk/`, etc. The Astro adapter selects per URL prefix. Simple, decent for small sites.
2. **Engine-extension fields** (works today per MIP-0009): records carry `$clearcms.translations: { en: {...}, uk: {...} }`. Mosaic-aware tools preserve them; Clear renders them. Best for sites where Clear is the primary engine.
3. **Future MIP-0014 — per-record locale suffix** (proper spec answer, 0.9): `about.md`, `about.uk.md`, `about.fr.md`. Engines pick locale by URL prefix + file suffix. Lightest possible spec amendment, maps naturally to Astro/Next conventions.

Recommended for clear-ucc: start with option 2 (works today), plan option 3 for the 0.9 spec cycle.

---

## Spec ambiguities surfaced by agents (worth your attention)

The agents found these while working. Each is small and fixable in a follow-up MIP or clarification:

1. **`./` ref vs `markdown` typed field.** A field declared `type: "markdown"` whose value is `"./notes.md"` — does ref-detection win (§5.7) or field type win? Currently §5.7 wins (unconditional). Spec should make this explicit.
2. **Selector targeting non-scalar values.** `ref:studio@principles` resolves to an array. Spec §5.6 only shows scalar examples. Engines might disagree on what to do with non-scalar selector targets.
3. **Body + `prose` section pointing back at the same `.md`.** Should the renderer inline both or just the section? Spec is silent.
4. **Redirect collision rule sharpness.** §3.6 says "redirect from collides with a real route" — does "real" mean page+record only, or everything in the route table (including other redirects)? Adapter and validator both interpret it the same way (only non-redirect routes count), but the spec could say so.
5. **`./` ref stub shape.** §5.8 describes stubs for `ref:` and `asset:` but not for `./`. The Astro adapter invented `{ $rel, path }`; the renderer uses similar. Spec should add a `./` stub shape paragraph.
6. **Page body + page sections.** Same theme as #3: a page with `index.md` AND `index.json#sections` — does the engine emit the body separately or only through a section?

These are small. Each is a one-line spec amendment or short MIP. None are urgent for 0.8 ship.

---

## Where to start your review

If you have 5 minutes: **`TRUTHS.md`**. Disagree with any axiom? The whole spec follows.

If you have 15 minutes: TRUTHS → README → `examples/minimal-site/` → `examples/hromada-community/mosaic.json` → SPEC §1, §3, §5.

If you have 30 minutes: above + skim each MIP + open `docs/showcase.html` in a browser + run `node tests/runner/run.js --tool "node tools/validate/impl/validate.js"` to see the conformance suite pass.

If you have an hour: build the astro-test site and click around. See how Mosaic content threads through Astro's routing.

---

## PR status

Branch is pushed but the draft PR couldn't be created automatically — `v0.8-draft` has no shared history with `main` (started from a fresh `git init` on the spec zip). To open a PR, you have three options:

1. **Treat 0.8 as a new root.** Force-push `v0.8-draft` over `main` once you've reviewed. Drastic; loses git history of older branches via `main`'s HEAD movement.
2. **Rebase v0.8-draft onto main.** Will require merge strategy decisions (the trees are very different).
3. **Skip the PR.** Browse the branch directly. Open a PR manually whenever you're ready to plan the rebase strategy.

I would recommend option 3 for tonight (just review the branch as-is) and option 2 later with proper attention to commit history.

---

## I did NOT touch

- `slavasolutions/mosaic` `main`, `v0.6-mips`, `v0.5.0`, or any existing branch. Only `v0.8-draft` was created.
- `slavasolutions/clear-ucc` (cloned read-only to `/home/ms/clear-ucc-ref/` for reference; no commits, no pushes, ever).
- The 0.6 reference clone at `/home/ms/mosaic-mip/repo/`.

---

Welcome back. Drop me a line and I'll keep iterating.
