# Mosaic 0.8 — Architectural roadmap

This doc captures the architectural changes proposed for 0.9 (or as 0.8 amendments before ship) that would **collapse multiple smaller issues** into single coherent fixes. Each "Arch" item destroys a cluster of bandages.

Issues are tagged by source: **A**\* = spec ambiguity, **B**\* = validator bandage, **C**\* = clear-ucc migration gap, **D**\* = agent-flagged ambiguity. See `BUILD_REPORT.md` for the source catalog.

---

## Arch-1 — First-class translatable fields

**Kills:** C1 (localized field maps stashed under `$astro.localized`), C2 (`<slug>.<locale>.md` convention not in spec), sets up cleanup of i18n out-of-scope notes.

**Status:** target 0.9. MIP-0014 candidate.

### Problem

clear-ucc and many real Astro sites store translatable content two ways:

1. **Field-level maps** — `{ "title": { "en": "About", "uk": "Про нас" } }` inside a record's JSON.
2. **Filename suffix** — `posts/launch.uk.md` alongside `posts/launch.md`, where the suffix is a BCP 47 locale tag.

Mosaic 0.8 has neither. The migrator stashes both under `$astro.*` engine-prefix fields, which works for round-trip but is invisible to the spec.

### Proposal

Introduce **two** orthogonal translatable mechanisms (authors pick whichever fits):

**A. Translatable string/markdown fields.** Either of these is valid:

```json
"title": "About us"                       // mono-locale
"title": { "$type": "translatable", "values": { "en": "About us", "uk": "Про нас" } }
```

Engines pick a locale; if the requested locale isn't present, fall back to `site.locale`, then to any locale (deterministic order).

**B. Locale-suffix records.** A record may have sibling locale files:

```
collections/news/launch.md
collections/news/launch.uk.md
collections/news/launch.json    (locale-independent fields)
```

Engines treat `<slug>.<locale>.md` as the markdown body for that locale; the JSON sidecar is shared.

### Why not just engine extensions?

`$astro.localized` works today (MIP-0009 preserves it), but every consumer reinvents how to render translations. First-class translatable shape means renderers, adapters, and editors can all agree on what "the Ukrainian title" looks like.

### Out of scope (defer further)

- Locale-prefixed routing (`/uk/about`) — separate concern, layouts/routing MIP cluster.
- Per-section translations.
- RTL hint propagation.

---

## Arch-2 — URL-first page walker

**Kills:** B1 (walker shape/route confusion), B3 (home.reserved `_url = null` hack), A8 (§2.6 vs §3.1 contradiction), A12 (deep page hierarchies underspecified).

**Status:** validator already mostly here after the recent fix. Spec needs the matching text. Target 0.8 amendment.

### Problem

The original validator treated `enumerateRecords("pages")` like `enumerateRecords("collections/news")` — flat, one level. For pages, this is wrong: SPEC §3.1 says "the path from `pages/` to the page determines its URL," which implies arbitrary depth.

The 0.8 spec gives no example deeper than `pages/<slug>/index.json`. The walker's bug surfaced this gap.

### Proposal

**Spec amendment to §3.1** — add explicit examples for deep paths:

```
| File | URL |
| `pages/archive/2024/winter.json` | `/archive/2024/winter` |
| `pages/about/team/index.md`      | `/about/team` |
| `pages/about/team.md`            | `/about/team` |
```

State the model: **one URL per record; shape (direct vs folder) is a storage choice, not a routing concept.**

**Add to §2.6:** drop the contradictory clause about `index.{md,json}` outside folder-shape records. The new rule: `pages/index.{md,json}` is the home; `<dir>/index.{md,json}` is the folder-shape record at `<dir>`; everywhere else `index` is just a slug like any other.

**Validator (already done):** walker descends every directory under `pages/`. At each level, a directory with `index.{md,json}` is a folder-shape record at that URL; other files are direct records nested below. Non-record directories are URL-prefix-only containers.

### Why architectural

It makes the page model **URL-first**: every node in the page tree resolves to exactly one URL or no URL. No special cases.

---

## Arch-3 — Universal `$`-prefix rule for engine extensions

**Kills:** A9 (prefix-style inconsistency between fields and codes), B4 (per-field exemption hack).

**Status:** target 0.8 amendment. Tiny spec edit.

### Problem

The spec has two namespacing conventions for engine extensions:

- §6.5 (codes): "Errors with `code` outside the spec's listed codes are engine extensions and MUST be prefixed (e.g. `clearcms.something`)." Plain prefix, dot-separated.
- §8.3.1 (fields, just added): engine-prefixed fields like `$mosaic.inferred`, `$clearcms.translations`. `$` sigil.

Two different conventions for the same concept. Confusing for engine authors.

### Proposal

Unify on `$`-sigil for **field names** anywhere in JSON; keep plain dot-prefix for **diagnostic codes** (different domain, no sigil expected in code identifiers).

**Spec edit:** add a §0.3 "Engine namespaces" that says explicitly:

> Engine-specific extensions use one of two namespacing conventions, depending on what's being named:
> - **Field names** in JSON anywhere (records, manifest, sections) → prefix with `$`. Example: `$clearcms.translations`, `$astro.localized`. Mosaic field validation skips any field whose name starts with `$`.
> - **Diagnostic codes** → plain dot prefix. Example: `clearcms.engine.warning`. Mosaic-defined codes are all `mosaic.*`.

**Validator:** apply the `$` exemption uniformly during JSON walk, not per-record (B4). Same for any future field-level checks.

---

## Arch-4 — Pin the index shape

**Kills:** A10 (undocumented `shape`, `files` fields), A11 (index URL semantics in embedded mode).

**Status:** target 0.8 amendment. Pure spec text.

### Problem

§7.1 shows an index example with fields `shape`, `files`, `data`, `body`. The first two are never defined elsewhere in the spec. Engines guess.

Separately, `pages` is keyed by `<url>`. In native mode the URL is what the engine serves; in embedded mode the host framework may rewrite URLs. The index's URL keys are ambiguous.

### Proposal

**Pin field definitions in §7.1:**

| Field | Type | Required | Meaning |
|---|---|---|---|
| `shape` | enum | yes | `"direct"` (file or sidecar pair) or `"folder"` (dir with `index.*`) |
| `files` | object | yes | `{ "md": "<path>"?, "json": "<path>"? }` — paths relative to site root |
| `data` | object | yes if json present | parsed JSON content of the record |
| `body` | string | yes if md present | raw markdown text |
| `sections` | array | optional | extracted from `data.sections` for pages |
| `url` | string \| null | yes (for routed kinds) | the spec's computed URL per §3.1 |

**Add clarifying paragraph:**

> The URL keys in the index are always the spec's computed URLs per §3 — not host-framework URLs. Embedded engines that rewrite URLs (e.g. add locale prefixes, mount under a subpath) MUST do so in their adapter layer, not by mutating the index. This keeps the index portable across hosts.

---

## Arch-5 — Body / sections mutual exclusion (or precedence)

**Kills:** D3 (renderer body+`prose`-section ambiguity), D4 (redirect collision sharpness — tangentially), clarifies §4.2.

**Status:** target 0.8 amendment. Spec text + small renderer update.

### Problem

A record can have both a markdown `body` and a JSON `sections` array. Some examples (hromada, complex-site) use a `{type: "prose", from: "./index.md"}` section in JSON pages that points back at the sibling markdown body. The renderer must choose: render the body separately, render only the section, or render both (double-content).

The reference renderer currently picks "section owns the body" — but the spec is silent.

### Proposal

**Spec rule (§2.7 new):**

> When a record has both a markdown body and a `sections` array in its JSON:
>
> 1. The `sections` array MUST own visible rendering. The body is treated as a default text source that sections MAY reference via `ref:` or `./` to surface its content.
> 2. Engines MUST NOT render the body as a separate block alongside sections. To include the body explicitly, add a `{ "type": "prose", "from": "./<filename>.md" }` section (or equivalent).
> 3. If `sections` is absent or empty, the body is rendered directly.

This is the rule the reference renderer already follows; lifting it into the spec means every engine agrees. Editors writing Mosaic content can rely on it.

---

## Smaller spec amendments (one-liners)

These don't need MIPs — just a sentence each in the right section:

- **A1** (empty folder under pages/): §3.1 — "A directory under `pages/` with no `index.{md,json}` and no nested page records is ignored (not a record)."
- **A2** (folder vs direct same slug): §2.5 — "A folder and a direct file with the same slug in the same directory are a structural error (`mosaic.slug.duplicate`)."
- **A3** (collision diagnostic source): §3.5 — "The `source` of a `mosaic.route.collision` is the canonical record path; the message names both URLs and both mounting pages."
- **A5** (trailing slash on `from`): §3.3 — "`from` MUST NOT end with `/`. Engines SHOULD normalize by stripping a trailing slash; tools MAY treat it as `mosaic.collection.missing`."
- **A6** (md-only relative-ref clause): §5.5 — drop the markdown-only sentence. Refs only exist in JSON; the case is impossible by construction.
- **A7** (`./` stub shape): §5.8 — "For `./` refs, the stub shape is `{ "$rel": "<path>", "url": "<url-or-null>", "title": "<resolved-title>" }`. Same fields as `ref:` but with `$rel` instead of `$ref`."

---

## Sequence

1. **Pre-0.8 ship** — apply Arch-2 (already done in validator), Arch-3 (small spec edit), Arch-4 (spec text), Arch-5 (spec text). All small, all confident.
2. **0.8 ship** — current state plus the above.
3. **0.9 cycle** — draft MIP-0014 (translatable fields, Arch-1), MIP-0015 (layouts, separate cluster), MIP-0016 (per-page/per-component design overrides).
4. **0.10 cycle and later** — MDX support, dynamic redirect patterns, fully thought-out i18n routing.

---

## What stays out of architecture

A few issues are intentionally **not** architectural — they're real engineering or content problems:

- 21 Astro `.astro` template-only pages → empty stub records (C4). Real conversion needs a template→sections transform, not a spec change.
- `images/images/` nesting (C5). Cosmetic; could be a migrator preference.
- Source-data drift like `galleries/vyshyvanka-day` missing date. Author problem, not spec problem.

---

## Status of each Arch item

| Arch | Kills | Target | State |
|---|---|---|---|
| Arch-1 translatable fields | C1, C2 | 0.9 / MIP-0014 | proposal only |
| Arch-2 URL-first page walker | B1, B3, A8, A12 | 0.8 | validator done, spec text pending |
| Arch-3 `$`-prefix universal | A9, B4 | 0.8 | proposal + tiny spec edit |
| Arch-4 pin index shape | A10, A11 | 0.8 | proposal + spec edit |
| Arch-5 body/sections precedence | D3 | 0.8 | proposal + spec edit |
| One-liners A1, A2, A3, A5, A6, A7 | (each) | 0.8 | spec edits pending |
