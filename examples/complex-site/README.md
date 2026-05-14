# Example: complex-site (Glasshouse Press)

A reference Mosaic 0.8 site that exercises every spec feature in a single, internally-consistent example. The fictional site is a small letterpress and book studio called Glasshouse Press — locale `en-US`, two-person team, a blog ("Journal"), a project catalog, an essays archive, and a colophon.

This is the stress-test example. The friendly tour lives in `examples/hromada-community`. Use this one to verify a reader/engine handles every shape the spec allows.

## Coverage map — every spec rule, where to look

| Spec rule                                              | Where exercised                                                                                       |
|--------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Root layout (§1)                                       | This directory                                                                                        |
| `mosaic.json` schema (§1.1, §8)                        | `mosaic.json`                                                                                         |
| All five top-level singletons + a custom one (§1.4)    | `site.json`, `header.json`, `footer.json`, `tokens.json`, `studio.json` (custom)                      |
| `images/manifest.json` shape (§1.5, §1.6)              | `images/manifest.json` (5 assets, includes width/height/alt/mime, plus a custom `caption` field)      |
| Records — direct `.md` only (§2.1)                     | _none — every md-only candidate needs a required field, so all records carry sidecar JSON or H1+JSON_ |
| Records — direct `.json` only (§2.1)                   | `collections/team/marcus-vale.json`, `collections/projects/folio-2024.json`, `collections/essays/on-running-out.json` |
| Records — direct `.md+.json` sidecar pair (§2.1)       | `collections/posts/2025-08-paper-arrives.{md,json}`, `collections/team/sasha-ren.{md,json}`, `collections/essays/on-margins.{md,json}`, `collections/posts/2025-07-letterpress.{md,json}` |
| Records — folder with `index.*` (§2.2)                 | `collections/posts/2025-09-on-glass/`, `collections/projects/atrium-quarterly/`, `collections/team/iris-okafor/`, `pages/about/` |
| Title precedence: JSON wins (§2.3)                     | `collections/posts/2025-08-paper-arrives.{md,json}` — JSON `title` matches H1; no dead-H1 issue       |
| **Title precedence: H1 supplies a required title (§2.3, T13)** | `collections/posts/2025-07-letterpress.{md,json}` — JSON has no `title`; `Post.title` is required; H1 "Why we still set type by hand" satisfies the requirement |
| Title precedence: H1 supplies optional title           | `collections/team/sasha-ren.{md,json}` — `TeamMember.title` is required; JSON omits it; H1 wins; `collections/essays/on-margins.{md,json}` — `Essay.title` optional, H1 supplies |
| No frontmatter (§2.4, T4)                              | Every `.md` file                                                                                      |
| Slug rules (§2.5)                                      | All slugs match `^[a-z0-9][a-z0-9-]*$`                                                                |
| Home is `/` (§3.2, T17)                                | `pages/index.json` + `pages/index.md` — no `pages/home.*` anywhere                                    |
| Page → URL transformations (§3.1)                      | `pages/about/index.{json,md}` → `/about`; `pages/journal.json` → `/journal`; etc. (see route table below) |
| `collection-list` routing (§3.3, §4.1)                 | `pages/journal.json`, `pages/projects.json`, `pages/team.json`, `pages/essays.json`                   |
| **Custom `urlPattern` (§3.3)**                         | `pages/journal.json` mounts `collections/posts` as `/journal/{slug}` (collection name `posts` differs from URL path `/journal`) |
| **`routes: false` mount (§3.4, T9)**                   | `pages/index.json` lists `collections/posts` with `routes: false`, `limit: 3`                         |
| **Multiple mounts of one collection (§3.5)**           | `collections/posts` is mounted twice: by `pages/index.json` (`routes: false`, limit 3) and by `pages/journal.json` (`routes: true`, custom `urlPattern`) |
| **Redirects (§3.6, T16)**                              | `mosaic.json#redirects` — three rules covering status `301`, `302`, `308`; `/people/iris → /team/iris-okafor` differs in path depth |
| Custom section types preserved (§4.2)                  | `hero`, `prose`, `feature-grid`, `pull-quote`, `cta`, `page-intro`, `stat-grid`, `principles`, `contact-block`, `definition-list` — none are normative; engines must round-trip |
| **All four ref forms (§5.1, T5)**                      | `ref:` (everywhere), `asset:` (`header.json`, `marcus-vale.json`, `index.json` hero, etc.), `./` (`pages/index.json`, `team/iris-okafor/index.json`, `projects/atrium-quarterly/index.json`, `posts/2025-09-on-glass/index.json`), `@selector` (see below) |
| **`asset:` shape** (§5.4)                              | `header.json` (`asset:images/logo.svg`), `pages/index.json` hero (`asset:images/hero-press.jpg`), `team/marcus-vale.json` (`asset:images/marcus.jpg`) |
| **Relative `./` from inside a folder record (§5.5)**   | `team/iris-okafor/index.json` (`./portrait.jpg`, `./bio.md`), `projects/atrium-quarterly/index.json` (`./cover-mock.jpg`, `./notes.md`), `posts/2025-09-on-glass/index.json` (`./glass-window.jpg`), `pages/about/index.json` (`./studio.jpg`, `./index.md`) |
| **JSON dot-path selector (§5.6)**                      | `footer.json` (`ref:site@contact.email`), `pages/colophon.json` (multiple: `ref:site@contact.email`, `ref:tokens@font.serif`, `ref:tokens@color.accent.press`) |
| **JSON array-index selector (§5.6)**                   | `footer.json` (`ref:header@nav.0.url`), `pages/colophon.json` (`ref:header@nav.0.label`), `pages/index.json` hero quote (`ref:studio@principles.0`) |
| **Markdown heading-slug selector (§5.6)**              | `pages/colophon.json` (`ref:essays/on-margins@why-margins-matter` → resolves to the `## Why margins matter` heading section) |
| **Tokens reference (§10.3)**                           | `pages/colophon.json` resolves `ref:tokens@font.serif` and `ref:tokens@color.accent.press` to DTCG `$value`s |
| Refs in arbitrary section JSON (§5.7)                  | `feature-grid` items, `definition-list` items, `pull-quote.text`, `cta.body` — none of these are spec-defined; engines must scan strings regardless |
| **Circular refs (§5.9, T7)**                           | `team/iris-okafor` ↔ `team/sasha-ren` ↔ `team/marcus-vale` — every team member's `colleagues` array points to the other two; engines must emit stubs and not blow the stack |
| Stub-based resolution (§5.8, T7)                       | Implicit — verifiable by any engine's index output                                                    |
| Tokens singleton (§10, T15)                            | `tokens.json` — DTCG shape with `color`, `font`, `space`, `radius`, `shadow` groups; nested categories (e.g. `color.accent.press`, `color.background.page`) |
| Custom singleton                                       | `studio.json` declared in `mosaic.json#singletons` with custom type `Studio`                          |
| `defaultSort` + `defaultMount` in manifest (§8.4)      | All four collections declare both; the mount page may or may not use the defaults                     |
| Type system: `array of object` with nested fields (§8.3) | `Project.credits` (array of `{role, person}`), `SiteConfig.social` (array of `{platform, url}`), `Header.nav`, `Footer.links` |
| Type system: `array of ref` scoped to a collection (§8.3) | `Post.related` (`to: posts`), `TeamMember.colleagues` (`to: team`)                                |
| Type system: nested object field (§8.3)                | `SiteConfig.contact` (object with `email`, `phone`, `address`)                                        |

## Why some checklist items moved

The original brief asked for at least one **direct `.md` only** record. Every collection in this site has at least one required field besides title (`Post.date`, `TeamMember.role`, `Essay.date`, `Project.title`) that can only come from JSON. A pure-markdown record would create a `mosaic.field.required` drift diagnostic on every type used here. To keep the site clean (per the brief: "No intentional structural errors, drift, or warnings"), every record carries at least the JSON it needs to satisfy its type. The "direct `.md`" shape itself is still exercisable — see `examples/hromada-community/collections/news/2025-03-12-launch.md` and `examples/minimal-site/pages/index.md` for that case. This example covers the other three record shapes thoroughly.

## Expected routes

| URL                                  | Source                                                            | Kind     | Status |
|--------------------------------------|-------------------------------------------------------------------|----------|--------|
| `/`                                  | `pages/index.{json,md}`                                           | page     | 200    |
| `/home`                              | _automatic_ (§3.2)                                                | redirect | 301 → `/` |
| `/about`                             | `pages/about/index.{json,md}`                                     | page     | 200    |
| `/colophon`                          | `pages/colophon.json`                                             | page     | 200    |
| `/journal`                           | `pages/journal.json`                                              | page     | 200    |
| `/journal/2025-07-letterpress`       | `collections/posts/2025-07-letterpress.{md,json}` via `/journal`  | record   | 200    |
| `/journal/2025-08-paper-arrives`     | `collections/posts/2025-08-paper-arrives.{md,json}` via `/journal`| record   | 200    |
| `/journal/2025-09-on-glass`          | `collections/posts/2025-09-on-glass/` via `/journal`              | record   | 200    |
| `/projects`                          | `pages/projects.json`                                             | page     | 200    |
| `/projects/folio-2024`               | `collections/projects/folio-2024.json` via `/projects`            | record   | 200    |
| `/projects/atrium-quarterly`         | `collections/projects/atrium-quarterly/` via `/projects`          | record   | 200    |
| `/team`                              | `pages/team.json`                                                 | page     | 200    |
| `/team/iris-okafor`                  | `collections/team/iris-okafor/` via `/team`                       | record   | 200    |
| `/team/marcus-vale`                  | `collections/team/marcus-vale.json` via `/team`                   | record   | 200    |
| `/team/sasha-ren`                    | `collections/team/sasha-ren.{md,json}` via `/team`                | record   | 200    |
| `/essays`                            | `pages/essays.json`                                               | page     | 200    |
| `/essays/on-margins`                 | `collections/essays/on-margins.{md,json}` via `/essays`           | record   | 200    |
| `/essays/on-running-out`             | `collections/essays/on-running-out.json` via `/essays`            | record   | 200    |
| `/blog`                              | `mosaic.json#redirects`                                           | redirect | 301 → `/journal` |
| `/journal/welcome`                   | `mosaic.json#redirects`                                           | redirect | 302 → `/journal/2025-07-letterpress` |
| `/people/iris`                       | `mosaic.json#redirects`                                           | redirect | 308 → `/team/iris-okafor` |

Note: the homepage lists posts (`routes: false`, limit 3) without minting record URLs. The `/journal/*` URLs come only from `pages/journal.json`'s mount. The two mounts do not collide because one is `routes: false`.

## Singleton inventory

| Singleton  | Type           | Notes                                                          |
|------------|----------------|----------------------------------------------------------------|
| `site`     | `SiteConfig`   | Identity content (display name, tagline, contact, social)      |
| `header`   | `Header`       | Logo + nav; nav array is targeted by array-index selectors     |
| `footer`   | `Footer`       | Resolves refs into nav and back into `site`                    |
| `tokens`   | `DesignTokens` | DTCG payload (color/font/space/radius/shadow)                  |
| `studio`   | `Studio`       | Custom singleton; principles array is targeted by index selector |

## Collection inventory

| Collection | Records | Mount(s)                                                            |
|------------|---------|---------------------------------------------------------------------|
| `posts`    | 3       | `pages/index.json` (`routes: false`, limit 3), `pages/journal.json` (custom `urlPattern: /journal/{slug}`) |
| `projects` | 2       | `pages/projects.json` (default routing, mounts at `/projects`)      |
| `team`     | 3       | `pages/team.json` (default routing, mounts at `/team`)              |
| `essays`   | 2       | `pages/essays.json` (default routing, mounts at `/essays`)          |

## Validating

The manifest validates against the canonical schema:

```
npx -y ajv-cli@5 validate \
  -s ../../mosaic.schema.json \
  --spec=draft2020 \
  --strict=false \
  -d mosaic.json
```

Expected output: `mosaic.json valid` (preceded by harmless "unknown format 'uri'" notices — ajv-cli v5 does not load `ajv-formats` by default; the format check is non-blocking).

## What's intentionally **not** here

- **No `redirects` singleton.** Redirects live inline in `mosaic.json` only. Mixing both is allowed by spec but triggers a `mosaic.redirect.duplicate-source` warning, which would violate this example's clean-site constraint.
- **No `pages/home.*`.** Reserved per §3.2 / T17.
- **No `mosaic.json#tokens` inline block.** Tokens live in the singleton only; doubling them would trigger `mosaic.tokens.duplicate-source`.
- **No frontmatter.** Forbidden per §2.4 / T4.
- **No orphan assets.** Every entry in `images/manifest.json` is referenced from at least one record. Every co-located image (`pages/about/studio.jpg`, etc.) is referenced from its sibling JSON.
- **No unrouted collections.** Every collection has a mounting page.

## Truths exercised

| Truth | Where |
|-------|-------|
| T1 — folder is the website        | Whole directory |
| T2 — five things on disk          | Manifest, pages, collections, singletons (5 of them), images |
| T3 — record shapes                | Three of four shapes used (see coverage table) |
| T4 — no frontmatter               | Every `.md` |
| T5 — four ref forms               | All four exercised |
| T6 — flat addresses               | `team/iris-okafor`, `posts/2025-09-on-glass` — split on first `/` |
| T7 — refs are stubs, cycles free  | Team `colleagues` form a triangle |
| T8 — three validation levels      | Site is clean: zero structural, zero drift, zero warnings expected |
| T9 — pages route, not collections | Posts collection minted onto `/journal/*` only via `pages/journal.json` |
| T10 — manifest, not snapshot      | `mosaic.json` declares structure; no route table or record list |
| T11 — preserve unknown fields     | Custom sections (`feature-grid`, `pull-quote`, ...) and `images/manifest.json` `caption` field rely on this |
| T12 — native or embedded engines  | Site is agnostic to delivery |
| T13 — title precedence            | `posts/2025-07-letterpress` exercises required-title-via-H1 |
| T14 — version in manifest         | `mosaic.json#version: "0.8"` |
| T15 — tokens are content          | `tokens.json` singleton + `ref:tokens@…` |
| T16 — redirects first-class       | Three explicit rules + the automatic `/home → /` |
| T17 — home is `/`                 | `pages/index.{json,md}`; no `pages/home.*` |
