# Peer review — Mosaic specification

**Reviewer:** [external CS reviewer, anonymised]
**Reviewing:** `README.md`, `spec.md` (v0.1), and `v0.2-changes.md` on branch `v0.2-draft`
**Date of review:** 2026-05-11

---

## Summary

Mosaic is a coherent, mostly implementable file-format proposal in the lineage of Astro Content Collections, Hugo data files, and Sanity's Portable Text, but elevated from a tool-local convention to a published spec. The substrate decisions — JSON for records, Markdown for prose, content-addressed assets via a path-keyed manifest, a closed slot-type taxonomy, RFC-2119 conformance levels — are individually sound and consistent with prior art. The novel contribution is not any single primitive but the *composition*: a single open spec that bundles records + schema + assets + i18n + globals + overlays at the granularity of "a whole website as an editable document." That composition is genuinely under-served by existing standards. However, the spec is not yet ready for v1.0: there are two outright section-numbering bugs, several normative ambiguities (slug rules, manifest fallback, ref id grammar), undefined terms ("block algorithm", "Tier 2 storage", "hybrid storage tier"), an unclosed reference syntax (`asset:content/...md` vs `asset:images/...jpg` distinction), and the implementer-facing JSON Schema and the formal grammar for reference strings are missing. The v0.2-draft additions are well-scoped and additive, but inherit the same documentation gaps as v0.1.

---

## Strengths

1. **Closed slot-type taxonomy with explicit per-type optional fields** (§4.4–§4.5). A table that lists `text`, `richtext`, `asset`, `ref`, `list`, `struct`, `code`, `number`, `boolean` and gives required-vs-optional addenda per type is exactly the right shape for a validator. This is sharper than JSON Schema's open-world model and sharper than Sanity's schema DSL.
2. **Conformance levels are clean and falsifiable** (§1). Level 1 / Level 2 / Level 3 each have a one-sentence MUST that an implementer can test against. Level 3's specific obligation ("MUST preserve concurrent edits without data loss") is unusual in CMS-adjacent specs and is admirable.
3. **Separation of "format" from "engine"** is maintained throughout the README and §11. The spec does not assume a CRDT, does not assume a particular renderer, and does not assume a particular storage backend. This is harder to do than it looks; many CMS exports fail this test in the first ten pages.
4. **Reference resolution algorithm is explicit** (§7), including the cycle-detection clause (§7.5). Most schema specs leave cycle behavior to implementations and accept the divergence that follows. Mosaic does not.
5. **Asset manifest decouples path from content** (§8). The "manifest is source of truth for which file is currently at this path; sha256 is informational for dedup" framing is clearer than git-LFS or DVC's model, and avoids re-inventing content-addressing semantics.
6. **Headless consumer silent-skip** (v0.2 §6.1). A genuinely useful contract that names a real-world tension: an RSS feed has no business emitting a `<missing template>` placeholder. The fact that the spec explicitly separates "valid per schema" from "supported by this consumer" is precisely the right axis. This is the strongest of the v0.2 additions.
7. **Forward compatibility clause** ("Unknown fields MUST be preserved by Level 2+ writers", §5; restated at §4.6a). Spec authors who think about Level-2 round-tripping write better specs.

---

## Critical issues (must fix before v1.0)

### C1. Two sections are both numbered `## 10`. `spec.md:530` and `spec.md:596`.

`## 10. Overlays (OPTIONAL)` (line 530) and `## 10. Versioning` (line 596) collide. v0.2 then introduces `## 10a. Layout pattern — outer / inner` (line 612) and `## 10b. freeform canonical block type` (line 633), so the numbering damage is propagating. The §6 cross-reference at §6.1 ("§6's preceding context", `spec.md:335`) is still parseable, but `§10b.6` and `§10b.1` cross-references at `spec.md:716` and `spec.md:640` only make sense after the duplicate `## 10` is resolved. The v0.2-changes.md acknowledges this as out-of-scope; it MUST be in-scope for v1.0. This is a normative spec; section numbers are the citation surface.

### C2. The reference-string grammar is described by example, never formally defined. `README.md:147–156`, `spec.md:355–419`.

A validator needs to know:
- Is `asset:images/hero.jpg` and `asset:content/blog/x.md` one syntax with implementation-defined disambiguation by file extension, or two distinct reference kinds? §7.4 (`spec.md:418`) calls the markdown form "a special form of §7.1" but does not say what makes it special — both resolve to `{ kind: "asset", ... }` per §7.1.
- What characters are valid in a `<path>` after `asset:`? The spec elsewhere constrains slugs (§2, `spec.md:42`) but says nothing about asset paths.
- What characters are valid in a `<collection>/<id>` after `ref:`? Is `ref:blog/2026-05-09-hello world.md` legal? Is the id allowed to contain `/`?
- What if the manifest stores `images/hero.jpg` but a slot says `asset:./images/hero.jpg`? Are leading `./` segments stripped? Trailing whitespace?
- Are reference strings case-sensitive?

Without a formal grammar (ABNF or even a regex per shape), two implementations will disagree on edge cases on day one. This is the highest-impact ambiguity in the spec.

### C3. "Block algorithm" appears in normative MUST but is never defined. `spec.md:21`.

Level 1 says "Validate `mosaic.json` against §4 (block algorithm) and §5 (schema)". §4 is titled "`mosaic.json` (the site schema)" — there is no "block algorithm" in §4. The term does not appear anywhere else in `spec.md` or the README. Either §4 needs a renaming, or "block algorithm" needs a definition, or this Level 1 MUST needs rewording. Right now an implementer cannot satisfy this MUST because they cannot find what to satisfy.

### C4. "Tier 2 storage" / "hybrid storage tier" referenced normatively but never defined. `spec.md:208`, `spec.md:405`.

§5.1 says `publishedHash` is "canonical hash of the last published slot content. Implementations using the hybrid storage tier (block bodies as content-addressed blobs) populate this; pure file-only sites can leave it null." §7.3 says `block:sha256-<hash>` references "Engine-internal block bodies (Tier 2 storage)". Neither "hybrid storage tier" nor "Tier 2 storage" is defined elsewhere in the spec. An implementer reading cold cannot tell whether they need a tier 1 or a tier 2 to be conformant, or what the contract is for either.

### C5. `slug` field semantics contradict between §2 and §5. `spec.md:42`, `spec.md:244`.

§2 says: "Slugs MUST start with `/` and contain only `[a-z0-9_-/]`." §5 says: `"slug": "string", // REQUIRED, MUST match its filesystem position`. The README example at `README.md:122` has `"slug": "a-site-is-a-document"` (no leading `/`) for a blog post. So either:
- §2's "MUST start with `/`" applies only to page records and the README blog example is using a different field semantics, OR
- §2 is wrong, OR
- blog records do not have a `slug` field per §2's rules and the README example is informal.

This needs to be resolved: either the spec says slug rules differ for pages vs collection records (and shows both), or one form is canonical and the README is corrected to match.

### C6. `mosaic.json#blockTypes` is declared REQUIRED but can be empty (§4.3, `spec.md:132`), while §5 requires every section's `blockType` to be declared (§6, `spec.md:322`).

If a site has an empty `blockTypes` map AND a non-empty `sections[]` array on a page, every section is invalid per §6. That is not necessarily a bug, but it means the minimal valid site is `blockTypes: {}` and `sections: []` everywhere. Worth saying explicitly. More importantly: the spec should clarify whether an empty `blockTypes` with no pages is conformant (probably yes, but the "REQUIRED — at least one page record" line in §3, `spec.md:55`, says otherwise — which means there is no zero-content valid Mosaic site, which seems wrong for a format spec).

### C7. Resolution algorithm references manifest fields that may not exist. `spec.md:373`.

§7.1 step 2: "Look up `<path>` in `assets/manifest.json#paths`. If found, set `sha256`." Step 3 then sets `url`. But §8 (`spec.md:441`) says: "If a `asset:` ref's path is not in the manifest, resolvers SHOULD still attempt to resolve it relative to the assets directory." Two questions the spec does not answer:
- If `assets/` exists but `manifest.json` is absent — is the site valid? §3 says manifest is REQUIRED if `assets/` exists (`spec.md:65`), but §8's SHOULD-clause implies resolvers should tolerate manifest absence anyway. Pick one.
- What if the manifest claims a sha256 that doesn't match the file's actual content? The spec calls sha256 "informational" but a Level 1 reader needs to know whether to fail loud, warn, or ignore.

---

## Major issues (should fix before v1.0)

### M1. `richtext` allows two completely different value shapes without a discriminator. `spec.md:155`.

A `richtext` slot's value is "string (Markdown by default) or Portable Text object". `format: "markdown" | "portable-text"` lives in the *SlotDef*, not in the value. That is acceptable for a single-format site, but it means a generic parser cannot tell from the value alone whether to parse a string as Markdown or refuse it as malformed Portable Text. Worse: in some patterns (translatable slots, where the value is a locale map of strings) the parser needs the SlotDef on hand to disambiguate. Either:
- Mandate that the value carries its own discriminator (`{ format: "...", body: "..." }`), OR
- State explicitly that `richtext` resolution REQUIRES the SlotDef context and validators MUST NOT attempt format-agnostic parsing.

### M2. `i18n.fallback` semantics are underspecified. `spec.md:232`.

`"fallback": "default" | "404"` is declared REQUIRED but the spec never says *when* fallback triggers, *what* falls back, or *how* `routing` ("prefix" / "subdomain" / "domain") interacts with it. Examples of unanswered questions:
- If a page exists in `en` but not `fr`, and a user requests the `fr` version, does `"default"` serve the `en` page at the `fr` URL, redirect, or render an empty placeholder?
- If a slot is translatable but only has `en` filled, does `"default"` fall back to `en` per-slot, or treat the whole record as untranslated?
- For field-level translation (`{ en: "...", fr: "..." }` shape), is a missing locale key the same as fallback, or is it an error?

These are normative questions; "implementation-defined" is not an acceptable answer for the field-level case because two implementations will produce different rendered HTML for the same Mosaic site.

### M3. `globalsOverride` syntax is structurally inconsistent. `spec.md:494–502`.

The example has three entries with the SAME key (`<global-id>`):

```json
"globalsOverride": {
  "<global-id>": "off",
  "<global-id>": "override",
  "<global-id>": { "instance": "<other-path>" }
}
```

This is illegal JSON (duplicate keys; behavior on parse is implementation-defined per RFC 8259 §4). I assume the intent is "the value can be one of three shapes per global id" — which means the example should be rewritten with three different `<global-id>` placeholders, or the syntax should be presented as a typed-union with a single example value. As written the example contradicts itself.

### M4. `position` vocabulary mixes absolute and relative addressing without precedence rules. `spec.md:467–477`.

`page-top`, `page-bottom`, `page-side-left`, `page-side-right` are absolute; `before:<id>`, `after:<id>`, `before-section:<n>`, `after-section:<n>` are relative. If global A is `"page-top"` and global B is `"before:A"`, the result is well-defined. But if A is `"page-top"` and B is also `"page-top"`, and `above`/`below` are not declared, what's the order? Document order in `mosaic.json#globals`? Alphabetical by id? Unspecified means non-portable.

### M5. `block:sha256-...` reference is described twice with different shapes. `README.md:154` vs `spec.md:404`.

README's table says it resolves to "A serialized block instance (engine-internal)" — implying an opaque blob. §7.3 says it resolves to `{ kind: "block", sha256, content }` where `content` is `{ ... } | null`. What's inside `content` is undefined. Is it a `SectionInstance` shape (with `id`, `slots`, etc.)? A bare `slots` map (like a global instance per §9.5)? Something else? Since this is the only ref-shape that is explicitly engine-internal, the spec may want to say "Mosaic does not specify the shape of `content`; that is an engine-level concern" — but it should say SOMETHING.

### M6. v0.2 §10b `freeform` uses `units` per-item but the visual outcome under canvas rescaling is open. `spec.md:664–691`.

This is already flagged in `v0.2-changes.md` open questions. I agree it's a real problem. Concretely: with `aspect: "16/9"` and one item at `units: percent` and another at `units: px`, what happens when the canvas renders at 800px vs 1600px wide? The px item stays the same physical size; the percent item scales. That is *probably* the intent, but the spec doesn't say. If the intent is "px items scale proportionally with the canvas" (i.e. px is interpreted at the declared aspect's natural size), say so. If the intent is "px is genuinely pixels at render time", say so. As written, two renderers will disagree.

### M7. v0.2 §4.2a's `tokenOverrides` rule against introducing new tokens is sound, but the resolution-for-unknown-name clause is split. `spec.md:120`.

"`tokenOverrides` MUST only override token names already declared at the site level. Introducing a NEW `<group>` or `<name>` via an override is INVALID; readers MUST ignore unknown overrides and SHOULD emit a warning." — the MUST and the MUST-ignore are good. But the spec doesn't say whether the rule applies recursively to overrides that *partially* shadow a group (e.g. site declares `color.ink` and `color.accent`; section override adds `color.accent` and `color.surface` where `surface` doesn't exist site-wide). Presumably `accent` overrides and `surface` is dropped+warned. Say so.

### M8. `Section instance lifecycle` (`README.md:193` and `spec.md:259`) introduces `state: "published" | "draft"` without saying how it interacts with `page.status`. `spec.md:266`.

If a page is `status: "published"` and contains a section with `state: "draft"`, the spec says "only editor sees" the draft section. So the rendered output is the page minus draft sections. Fine. But: does the draft section count toward `sectionLayout.area` assignment (v0.2 §5.1a)? Toward `globals` relative position (`before-section:<n>`)? Toward `publishedHash` computation? Important enough to spell out.

---

## Minor issues / nits

- **`spec.md:1` — title is "Mosaic — normative specification" but `Version: 0.1 (draft)` is a contradiction-in-spirit**; either it's a draft (non-normative) or it's normative-but-pre-v1.0. Standard fix: say "non-normative draft" or "normative; subject to change pre-v1.0".
- **`README.md:339`** — "TOML and Markdown" appears in a paragraph that elsewhere describes Mosaic as JSON+Markdown. Either Mosaic accepts TOML (it does not, per §2 and §4) or this is a typo for JSON.
- **`README.md:386`** — "Snapshot exports from CRDT engines may use engine-specific extensions (Clear uses `.clear` for binary snapshots)" — but `spec.md:41` says "engine snapshots use `.loro`". Pick one for the spec text; the README and spec should agree, even if Clear specifically uses both.
- **`spec.md:30`** — "Level 1 + MUST be able to produce Mosaic output: write `mosaic.json` and content files such that another Level 1 implementation reads them without error." "Without error" is doing a lot of work — does that include warnings? Recommendation: "without raising any error, and SHOULD produce no validation warnings for content that originated as valid Mosaic."
- **`spec.md:43`** — "`/` is the directory separator." This is a filesystem-conformance assertion but Windows uses `\`. Say: "On Windows filesystems, implementations MUST translate `\` to `/` when serialising paths in JSON."
- **`spec.md:54`** — "Implementations MAY accept the name `clear.json` as a synonym." This bakes the reference implementation's name into a normative permission. Either drop it (a Level-2 writer MUST emit `mosaic.json` and that's the spec's concern) or generalise to "MAY accept additional implementation-specific schema filenames as synonyms." Right now it gives a single vendor's name special status in the spec.
- **`spec.md:104`** — "Common groups (by convention, not enforced): `color`, `font`, `size`, `space`, `radius`, `shadow`, `leading`, `tracking`, `weight`, `duration`, `ease`." Suggest moving this to an appendix as a recommended-vocabulary list. As a normative paragraph it's neither prescriptive nor descriptive.
- **`spec.md:155`** — `richtext` row says `format: "markdown" | "portable-text"` — pipe character renders fine in raw GFM but the rest of the spec uses backtick-quoted alternatives like `"draft" | "published"`. Pick one style and apply consistently.
- **`spec.md:185`** — `type: "list"` row mentions `of: <type>` with values including `"ref:<collection>"`. That uses the same prefix-colon syntax as the resolved references in §7 but in a SCHEMA position. Is `"ref"` (no colon) also acceptable when paired with a separate `refTo: <collection>` field, mirroring §4.5's `ref` row? The spec has two ways to say "this list contains refs to collection X" and they're not aligned.
- **`spec.md:226`** — "Required: `title`, `slug`, `status`, `sections`. All others optional." But §5 (`spec.md:243`) shows `sections` as `// REQUIRED (MAY be empty)`. Confirm whether "required" here means "field key must be present" (so `"sections": []` counts) or "field must be non-empty".
- **`spec.md:329`** — "Readers MUST surface them via: A warnings channel (CLI, log, API field) / Optional refusal to render (configurable strictness)" — the second bullet is OPTIONAL, so use "MAY" not just bullet ordering. RFC-2119 hygiene: bullets after a MUST should themselves be MUST unless marked.
- **`spec.md:386`** — `ref:blog/a-site-is-a-document` example uses an id without a leading slash; `slug` in the same record (per §5) presumably starts with `/`. The id-vs-slug distinction is implied but never stated. Say: "the `<id>` in a ref is the record's file basename (without `.json`), not its slug."
- **`spec.md:419`** — §7.4 title is "`asset:content/<path>.md`" but the prose body discusses CommonMark + GFM in general. Suggest renaming to "Markdown body references" or "Inline-loadable Markdown assets" so the section is searchable by what it does, not by an example URL.
- **`spec.md:583`** — "Unknown overlay block types render via the standard fallback (`missing template` — see §6)." §6 does not contain the words "missing template"; that's mentioned only at §6.1 (`spec.md:336`). Cross-reference should be §6.1.
- **`spec.md:715`** — §10b.6 "headless consumers (§6.1) SHOULD include `freeform` in their skip set unless they specifically support it." Per v0.2-changes.md open questions, consider promoting this from SHOULD to a default-skip-set RECOMMENDATION at §6.1.
- **`v0.2-changes.md:33`** — "Notes flagged about existing v0.1 spec (not changed in this draft)" — these notes belong in spec.md as `// TODO` markers or in a tracked issues file, not in the v0.2 changelog. They will be lost when v0.2-changes.md is rolled into the main changelog.

---

## Underspecified areas

The following are places where the spec is silent in ways that will cause implementer divergence. Listed roughly in order of impact.

1. **Reference grammar.** See C2. The single highest-priority gap.
2. **What counts as "empty" for a required slot.** §6 says "absent, null, or empty string". For non-string types: is `[]` empty for a `list`? Is `{}` empty for a `struct`? Is `0` empty for a `number`? Is `false` empty for a `boolean`? Probably no for the last three, but the spec only addresses strings.
3. **Slot value canonicalisation.** Two slot values that are semantically identical (whitespace, key order, trailing commas) — must readers normalise before hashing for `publishedHash`? If yes, what's the canonical form? (RFC 8785 JCS is the obvious answer.) Without this, `publishedHash` cannot be portably computed across implementations.
4. **Locale fallback at the slot level.** See M2.
5. **What a Level 2 writer MUST preserve.** §4.6a (`spec.md:209`) says "Unknown fields in a `LayoutSpec` MUST be preserved by Level 2+ writers." §5 says the same for pages. But the spec does not say this universally — what about `mosaic.json` itself, sections, structs, collections, globals, overlays? State once, globally: "Unknown fields anywhere in a Mosaic document MUST be preserved by Level 2+ writers."
6. **Concurrent writer obligations.** Level 3 MUST "preserve concurrent edits without data loss." But the spec gives no semantics for *what* counts as data loss — last-write-wins on a string slot? Element-level merge on a list slot? Object-level merge on a struct? Without merge semantics, Level 3 conformance is unfalsifiable.
7. **`publishedHash` computation.** Spec says it's "canonical hash of the last published slot content" (`spec.md:208`). Hash of which serialisation? Of which subset of the slots map (only `state: published`?)? Of canonical JSON or the wire bytes? Without a canonical form, the hash is implementation-defined and the field is useless for cross-implementation verification.
8. **Asset path normalisation.** See C7.
9. **Validation order.** If a section is invalid AND its `blockType` is in the consumer's skip set (v0.2 §6.1), is it dropped silently or surfaced as a warning? §6.1 says "MUST NOT raise a validation warning for the unsupported `blockType` itself" but doesn't explicitly settle whether OTHER validation issues on a skipped section surface. Probably: do not validate skipped sections at all. Say so.
10. **Schema migration.** §10 (Versioning, `spec.md:602`) says "A site's `schemaVersion` MUST bump on" certain changes. But what happens when a renderer reads a site at a higher schemaVersion than it understands? No migration mechanism, no compatibility table. This is the gap that "Block algorithm migration" is gesturing at in §12.
11. **JSON Schema for `mosaic.json` itself.** §12 lists this as a v0.2 plan; v0.2-changes.md does not deliver it; without it, "validate `mosaic.json` against §4" is paragraph-by-paragraph implementer work.

---

## Comparisons

For the major design choices, the closest existing standards and how Mosaic differs.

### Structured rich text (slot type `richtext`)

- **Portable Text (Sanity)** — block-level rich text with inline marks and references; spec'd at portabletext.org. Mosaic explicitly allows Portable Text as a `richtext` format. **Where Mosaic differs:** Portable Text is one block at a time; Mosaic is the whole-document substrate that hosts Portable Text inside a slot. **Where it derives:** the use of an `_type`-discriminated tree to represent inline structure is conceptually identical.
- **MDX** — Markdown with embedded JSX components. Mosaic deliberately does NOT embed components in prose; structure lives at the section level, not inside the prose stream. **Where Mosaic differs:** explicit rejection of "the prose is the substrate"; structure-first.
- **TipTap / ProseMirror schemas** — typed inline structure with extension nodes. Mosaic is parallel to this at the document level rather than the paragraph level.

### Schema for a content model (`mosaic.json#blockTypes`)

- **JSON Schema (Wright, Andrews, et al.)** — the obvious comparator. JSON Schema is open-world by default; Mosaic's closed slot-type taxonomy (§4.4) is intentionally narrower. **Where Mosaic differs:** closed taxonomy, no `$ref`-style schema composition, no conditional schemas. Cheaper to validate, easier to author by hand, less expressive.
- **Sanity schema DSL** — JavaScript-defined schemas with typed fields. Mosaic resembles this in spirit but lives in JSON not JS. **Where Mosaic differs:** declarative (not code), portable across runtimes.
- **Astro Content Collections** — Zod schemas inside the build tool. **Where Mosaic differs:** Astro's schema is locked to a runtime; Mosaic's is freestanding.
- **Hugo frontmatter / data files** — convention-driven, not formally schema'd. **Where Mosaic differs:** Mosaic has a schema; Hugo really doesn't.
- **JCR / CMIS** — old enterprise CMS standards. Mosaic's README explicitly notes these are aimed at document management, not modern sites; correct.

### Asset addressing (`assets/manifest.json` + `asset:` refs)

- **git-LFS** — content-addressed assets, but bound to git as a transport. **Where Mosaic differs:** the manifest is a plain JSON file in the tree, no special VCS support required.
- **DVC (Data Version Control)** — similar manifest pattern for ML datasets. **Where Mosaic differs:** Mosaic's path-as-primary, sha-as-informational ordering is the opposite of DVC's hash-as-primary model. Mosaic's choice is correct for renames-as-first-class; DVC's is correct for deduplication-as-first-class.
- **Subresource Integrity (SRI)** — sha hashes on external assets. Mosaic's sha256 in the manifest is structurally similar but local.

### Page-as-tree-of-sections (`page.sections[]`)

- **Hugo page bundles** — directories with `index.md` and resources. **Where Mosaic differs:** Mosaic is JSON-first with Markdown as a sibling, not Markdown-first with frontmatter. The shift matters: JSON is unambiguously structured; frontmatter formats vary.
- **Eleventy data cascade** — layered data merging. Mosaic has nothing like the cascade except via v0.2 `tokenOverrides`, which is much more constrained (token names only).
- **WordPress Gutenberg block grammar** — HTML comments delimit serialised blocks in a post body. Mosaic's `sections[]` is the spiritual successor, but as first-class JSON instead of embedded comments. **Where Mosaic genuinely improves:** the structure is queryable; Gutenberg block grammar requires regex parsing of HTML comments.
- **Notion blocks** — typed blocks with children. Mosaic's flat `sections[]` is a deliberate simplification: no nesting inside sections (other than within slot values).

### Layouts (v0.2 §4.6a)

- **CSS Grid `grid-template-areas`** — the source. v0.2's `areas` is a direct lift. **Where Mosaic differs:** breakpoint keys + viewport mapping live in the spec, not in CSS. This is reasonable for a presentation-agnostic format that nonetheless wants to communicate intent to renderers. **Where it derives:** verbatim from CSS Grid.
- **Tailwind's responsive prefix system** — comparable in spirit; Mosaic's breakpoint keys are unprefixed and need their own min-width mapping. Cleaner for non-CSS targets.

### Globals + overlays (§9, §10)

- **Hugo's `partials` and `shortcodes`** — closest analogues for globals. **Where Mosaic differs:** globals have a declared injection POSITION and a global registry in the schema; Hugo partials are call-site-driven.
- **Astro layouts** — layout components that wrap pages. Mosaic's `page.layout` field gestures at the same idea but is "renderer-specific" per §5, which is a punt.
- **Overlays:** I do not know of a direct standard for "modals/lightboxes as declared site-level elements with trigger conditions and persist windows." This is genuinely novel in the spec space (though every CMS plugin marketplace has implemented variants of it ad hoc). The vocabulary (`scroll:N%`, `delay:Nms`, `exit-intent`, `first-visit`, `dismissed-for-7d`) is reasonable and well-chosen.

### Consumer capability declaration (v0.2 §6.1)

- I am not aware of a direct prior art for "the consumer publishes a supported-blocks set and silently drops the rest" in a format spec. The closest is HTTP `Accept` headers (content negotiation) at the protocol level. Sanity's GROQ projections are a different shape — query-time selection, not consumer-side filtering. **This is the most novel contract in v0.2.**

### Freeform block (v0.2 §10b)

- **SVG `<g>` with positioned children** — the obvious low-level analogue.
- **Figma / Sketch JSON exports** — they have `x/y/w/h` per element, but they're full design files, not content-format slots.
- **Webflow's absolute-positioning mode** — comparable, proprietary.
- **Where Mosaic differs:** by being explicit about the portability cost (`§10b.6`). Most absolute-positioning systems pretend they're portable; Mosaic admits they aren't. This honesty is unusual and good.

### Overall

Mosaic's novel composition is the bundle. No existing open spec I know of covers, in one document, all of: schema for block types, slot type taxonomy, asset manifest, page sections, collections with both single-file and per-record layouts, i18n routing, site-wide globals with injection positions, overlays with triggers and persist windows, and consumer-capability silent-skip. Each piece on its own derives from prior art; the composition is the contribution.

---

## Recommendations

A short ordered list of small, surgical changes that would do the most for v1.0.

1. **Fix the duplicate `## 10` and renumber downstream sections in one commit.** (C1.) Five minutes of work; eliminates the worst structural defect. Audit every `§N.M` cross-reference in the file as part of the same commit.
2. **Add Appendix C — Reference string grammar.** (C2.) An ABNF (or a regex per shape) for `asset:`, `ref:`, `block:`, and the special `asset:content/...md` form. Specify: allowed character classes, case sensitivity, leading-`./` normalisation, path separator. This is the single highest-leverage addition.
3. **Define "block algorithm" or remove the term.** (C3.) Most likely fix: rename §4 to "`mosaic.json` (the site schema and block algorithm)" if "block algorithm" is meant to refer to the schema-driven section validation procedure; or rewrite Level 1's MUST as "validate `mosaic.json` against §4 and §5". Either is fine; choose one.
4. **Define "Tier 2 storage" / "hybrid storage tier" in a new §0 — Terminology, or remove the references from normative sections.** (C4.) The `block:` ref shape and `publishedHash` field are both gated on this concept; right now an implementer cannot determine what the contract is.
5. **Add a `Validation hashing` subsection.** (Underspecified §3, §7.) State the canonical JSON serialisation (RFC 8785 JCS is the obvious choice), state how `publishedHash` is computed, state whether unknown fields are included. Without this, Level 3 implementations cannot interoperate on hash-based comparison.

Beyond these five, the next-most-valuable improvements are M2 (i18n fallback) and the JSON Schema for `mosaic.json` itself (already in §12's open questions). Both are large enough that they don't belong in the "small surgical" list.

---

*End of review.*
