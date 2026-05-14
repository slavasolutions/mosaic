# Mosaic — Truths

The 0.8 spec sits on top of seventeen axioms. Every rule in `spec/SPEC.md` traces back to one of these. Every MIP records the decision behind one of them. If a truth changes, the spec changes; if a truth holds, the spec holds.

Read this first. Argue with it before arguing with the spec.

---

1. **The folder is the website.** Mosaic describes a directory on disk. The filesystem is the source of truth. Engines read it; nothing else is canonical.

2. **A site has five things on disk.** A manifest (`mosaic.json`), routed pages, collections of records, singletons at the root, and (optionally) images. Anything else is ignored.

3. **A record is markdown, JSON, or both.** One file, a sidecar pair, or a folder containing `index.*`. Same rules everywhere.

4. **Frontmatter is forbidden.** JSON is the only structured channel. A third channel forces a precedence rule that's never clean.

5. **Refs come in four forms.** `ref:`, `asset:`, `./`, and `@selector` suffixes. Engines detect refs by scanning string values for these prefixes — not by consulting a schema.

6. **Addresses are flat.** A ref's address is either a singleton name or `<collection>/<slug>`, split on the first `/`. No deeper paths. No nesting.

7. **Refs are stubs in the index.** No eager inlining. Cycles are free. Consumers follow stubs on demand.

8. **Validation has three levels.** Structural (no index produced), drift (index produced and reported), warning (cosmetic). Every diagnostic carries a stable error code.

9. **Routing is declared by pages, not collections.** A collection becomes URLs only when a page mounts it with `collection-list`. `routes: false` mounts list without claiming URLs.

10. **`mosaic.json` is a manifest, not a snapshot.** It declares what the site *should be* — identity, types, collections (with defaults), singletons, redirects, tokens. The folder is what currently *is*. A manifest plus seed content is a shareable template.

11. **Writers preserve unknown fields.** Any tool that writes a Mosaic file MUST round-trip unknown fields verbatim. No silent data loss.

12. **Engines run native or embedded.** Native engines use Mosaic's route table to serve URLs. Embedded engines treat the index purely as a queryable content store while a host framework (Astro, Next, SvelteKit, etc.) owns routing. Both are first-class.

13. **Title precedence is JSON > markdown H1 > slug.** Required-title validation runs against the *resolved* title, not the raw JSON field.

14. **The spec version is declared in `mosaic.json#version`.** Engines MAY refuse to read sites whose version they do not support.

15. **Design tokens are content.** Stored as a root singleton (`tokens.json` by convention), shaped per the [Design Tokens Community Group](https://www.w3.org/community/design-tokens/) format. Mosaic defines where tokens live and how they're addressed, not what colors a site should use.

16. **Redirects are first-class.** Declared in the manifest. Map old URL → new URL. Loops are structural errors. Renderers emit them as HTTP 301 hints or `<meta http-equiv="refresh">` placeholders; routing engines apply them server-side.

17. **Home is `/`.** `pages/index.{md,json}` mints the home route at `/`. The slug `home` is reserved at the top level of `pages/`. Engines automatically alias `/home` to `/` via the redirects mechanism so that authors and visitors never collide on the spelling.

---

## What changes if a truth changes

| Truth | Change consequence |
|---|---|
| 1, 2, 3 | Folder layout and record shapes; affects every reader. |
| 4 | Tooling needs to strip or read frontmatter; cascading. |
| 5, 6, 7 | Ref grammar and resolution; affects every consumer. |
| 8 | Validator contract and CI behavior. |
| 9 | Routing model and rendering. |
| 10 | Manifest shape; affects `init`, `migrate`, `infer`. |
| 11 | Writer-side guarantees; affects `fix`, `migrate`, editors. |
| 12 | How engines plug into host frameworks. |
| 13 | Required-field semantics; affects every validator. |
| 14 | Version-skew behavior; affects forward compat. |
| 15 | Design tokens location; affects renderers and theming. |
| 16 | Redirect mechanism; affects routing tables. |
| 17 | Home conventions and navigation. |

---

## What stays out

These were considered and intentionally not lifted into truths:

- **Layouts** — page templating with breakpoints, grid areas, etc. Not in 0.8. Will be its own MIP cluster once authoring experience exists.
- **Design overrides per page / per component / per record.** Deferred until layouts land.
- **i18n beyond a `locale` field.** Translation key serialisation, locale fallback policies, locale-prefixed routing — out of scope for 0.8.
- **Auth, access control, drafts, revisions.** Engine concerns.
- **Hosting, deployment, CDN.** Engine concerns.
- **Search indexes.** Engine concerns.
- **MDX.** Out of 0.7; still out of 0.8.

If any of these matter for your engine, build them as engine extensions. The unknown-field preservation rule (truth 11) lets engine-specific data survive a round-trip through a different engine without loss.
