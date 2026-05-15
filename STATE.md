# Mosaic 0.9 — Working Overview

> **Living document.** All decisions made this session, all open questions, all answers inline. Updated 2026-05-15. Branch: `0.9-realignment` (8 commits). Read top-to-bottom.

---

## Status snapshot

| Item | State |
|---|---|
| Spec version | 0.9 (draft) |
| Branch | `0.9-realignment` — 8 commits |
| License (live on main) | CC BY 4.0 (spec) + Apache 2.0 (code) — PR #2 |
| Trademark | "Mosaic", "MIP" — Slava Solutions |
| Conformance | 33/34 (pre-realignment) |
| Production consumers | Zero. `clear-ucc` live URL is on legacy code, not Mosaic format |
| Production risk of breaking changes | None — break freely |

---

## Principles — 3 foundational claims

The spec derives from these. Plain language, no MUST/MAY. See `PRINCIPLES.md` for the canonical file.

### 1. The folder is the website
The filesystem is the source of truth. Files are records (`.json` = structured, `.md` = prose, anything else = binary/non-text content). Folders group records into collections.

### 2. Refs link records
One `ref:` prefix with three anchoring modes: cascade lookup (default — walks the parent chain outward), `/` for absolute from root, `./` for explicit relative. Deeper-wins cascade plus deep merge: same-named records placed deeper override shallower ones; objects merge by field, arrays replace whole. Cycles are free.

### 3. Forward-safe
Engines decide URLs. Writers preserve unknown fields. Extensions use the `x-` marker (fields as `x-<ns>.<key>`; sidecar files as `<slug>.x-<ns>.json`). Types MAY declare an optional `@type` field for schema.org alignment — see the Schema.org section below.


## Open questions remaining

| # | Question | Status | My pick |
|---|---|---|---|
| 1 | Frontmatter — silent / ban / future MIP? | Open | Silent + future-MIP placeholder |
| 2 | Cascade + locale interaction order? | Open | Needs concrete examples; defer |
| 3 | Core in spec, or separate impl? | Open | Separate. Spec defines format; core is one of several engines |
| 4 | MosaicDB direction — what is it? | Open | A general filesystem-backed engine reusable for R2 OR local FS. Could be `@mosaic/db` |
| 5 | Should `.mosaic` index require CLI tooling, or be hand-authorable? | Open | Hand-authorable. CLI speeds it up. Index is NOT spec-required; engines emit it |
| 6 | Native folder mounting vs `collection-list` section? | Considered, rejected | Section JSON stays. Folder marker would duplicate |
| 7 | Compressed collection format (single-file collection)? | Future | 0.10+ MIP candidate |
| 8 | Should locale-folder pattern be supported? | Future | Engine-side decision; spec stays silent on folder-style locale; MIP-0014 filename suffix is the canonical pattern |
| 9 | Decision-tree visualization — how (since mermaid sucks)? | Open | See ALTERNATIVES section below |

---

## Ecosystem

| Layer | Project | Role | License |
|---|---|---|---|
| Spec | `slavasolutions/mosaic` (this repo) | The format | CC BY 4.0 + Apache 2.0 |
| Engine SDK | `@mosaic/core` | Walker / parser / validator / index builder | Apache 2.0 |
| Engine CLI | `@mosaic/cli` | Terminal commands wrapping core | Apache 2.0 |
| Engine adapter | `@mosaic/astro` | Astro integration | Apache 2.0 |
| Engine adapter (future) | `@mosaic/next` | Next adapter — proves core is framework-agnostic | Apache 2.0 |
| App | `mosaic-explorer` (separate repo) | POC editor/viewer; Bun binary + NPM install | MIT or Apache 2.0 |
| App (future) | `mosaic-site` (separate repo) | Dogfood website — Mosaic-shaped content, GH Pages | MIT |
| Engine variant (future) | `mosaic-edge` or `@mosaic/db` | Generic filesystem-backed engine (local FS, R2, S3) | Apache 2.0 |
| Downstream product | `clearcms/clear` | Full CMS built on Mosaic | Apache 2.0 (engine) + proprietary (UX) |

**Question 3 — core in spec or separate?**
My pick: **separate**. Spec defines what a valid Mosaic site looks like. Core is one reference implementation. Other implementations (Go, Rust, Python, Java) should be welcome. Mosaic Spec ships with Apache 2.0 core as a reference; engine-builders MAY reuse or reimplement.

**Question 4 — MosaicDB direction:**
You clarified: not R2-only. General engine to bolt onto any filesystem for DB-like access. Reframe:

- `@mosaic/db` (or similar) = a stateful engine that holds a Mosaic site, exposes read/write/query API. Backend agnostic — local FS, R2, S3, Drive, anywhere objects can be stored by path.
- Built on `@mosaic/core` (uses the walker/parser/validator).
- Other engines (Astro adapter, Next adapter) can wrap or compose `@mosaic/db` if they want runtime state. Or just use `@mosaic/core` directly for stateless.
- Could BE the viewer/editor's backend. Studio = UI on top of `@mosaic/db`.
- Clear = full product on top of `@mosaic/db` + custom UX.

This is post-1.0 territory. File in V1.md futures.

---

## Process (locked)

### Versioning rule
Each non-discarded work session = one CHANGELOG entry = one version step. Patch / minor / major. Pre-1.0 minor allowed to break.

### MIP process
Single folder `mips/`. Rust-style template. Numbered sequentially. Both spec changes and process decisions land here.

### Skills (in `skills/`)
- `release.md` — version bump + changelog + tag + PR
- `status.md` — repo state snapshot
- `session-start.md` — onboarding into a session
- `session-end.md` — closing cleanly
- `propose-mip.md` — author a MIP

### Source-of-truth layers
- `PRINCIPLES.md` — foundational claims (this doc's source)
- `SPEC.md` — normative rules
- `mips/MIP-NNNN.md` — decisions and alternatives
- If the same fact lives in two of these, delete one.

---

## Protection (live on main)

- **CC BY 4.0** for spec text (attribution required)
- **Apache 2.0** for code (explicit patent grant)
- **Trademark on Mosaic + MIP** — Slava Solutions
- **NOTICE, TRADEMARK, SECURITY, CONTRIBUTING** all live as of PR #2
- **USPTO trademark filings** — pending (recommendation: file ITUs in Class 9 + 42 for both Mosaic and ClearCMS; engage attorney; ~$3-6k with one)
- **Defensive publication** — git history + npm publishes provide prior art; supplement with Software Heritage + Zenodo DOI when ready

---

## Decision log (this session, chronological)

1. Renamed TRUTHS → PRINCIPLES (file + concept)
2. Reduced 17 axioms to 7 hybrid-format claims (heading + 1 explainer)
3. Added 8th claim "JSON only structured channel" after devil's advocate review
4. Hoisted SPEC.md from `spec/` subdir to root
5. Folded OVERVIEW.md content into README
6. Archived ARCHITECTURE.md + BUILD_REPORT.md to `archive/0.8.1/`
7. Kept name "MIP" (no rename to RFC)
8. Adopted Rust-style MIP template
9. Reconstructed CHANGELOG with placeholders for 0.0–0.5
10. Added skills/ folder with 5 process docs + index
11. Versioning rule = session-equals-step (in CONTRIBUTING + AGENTS)
12. Drop "singleton" / "global" term; everything at root is a record
13. Drop `collections/` parent; collections directly at root
14. Pages is just a collection routed by engine convention
15. Cascade walks parent chain (no special carveouts)
16. Sidecar override = cascade applied to globals (same mechanism)
17. Single ref grammar: `ref:` + three anchors (cascade / `/` / `./`)
18. `@` selector preserved in ref grammar (restored after near-drop)
19. Unified `x-` namespace marker for fields AND sidecars
20. JSON is always the structural index; MD is referenced content
21. Smart-default auto-link: `<slug>.md` becomes body of `<slug>.json` if JSON has no body field
22. `.mosaic` = zip with renamed extension (EPUB-style); one canonical format
23. `mosaic.cascade.shadow` warning on cross-folder cascade resolution
24. Cross-engine round-trip testing as standard conformance pattern
25. `MOS-CONFLICT` marker convention for on-disk conflicts
26. Frontmatter = silent in spec (option A); future MIP placeholder
27. Copyright holder = Slava Solutions (not personal name)
28. License migrated CC0 → CC BY 4.0 + Apache 2.0
29. Trademark policy added (Mosaic + MIP)
30. NOTICE + SECURITY + CONTRIBUTING shipped

---

## Decision-tree visualization — alternatives to Mermaid

You're right that mermaid renders badly for nodes with deps. Alternatives I'm aware of:

- **D3.js force graph** — interactive, dependencies as edges. Requires HTML+JS.
- **Plain nested markdown lists with status badges** — `- [x] Locked` / `- [ ] Open`. Renders everywhere, no JS.
- **Notion-style toggle blocks** — collapsible sections. Renders in Notion, GH issues.
- **GitHub Project Board** — kanban-style with deps. Native to GitHub.
- **Tree-based tools like Logseq, Obsidian** — backlinks make implicit graph.
- **Excalidraw, tldraw** — hand-drawn diagrams; not for big trees but good for concept maps.
- **mdast / mdx-treenode** — structured markdown trees.

**My pick:** stop using mermaid for the decision tree. Use this document (STATE.md) as the source of truth. Each section is a node. Status emoji shows state. Deps are referenced inline by section number. Plain text, scales, renders everywhere. The HTML version (`STATE.html`) can add toggles + nav for visual layering, but the MD is canonical.

---

## What's NOT changing in 0.9 (deferred)

These came up but defer to later releases or are non-blocking:

- Compressed collection format (single-file collections) → 0.10+ MIP
- Images-as-records full lift → 0.10+ MIP (currently implicit; spec doesn't enumerate)
- Locale-folder pattern → 0.10+ MIP paired with locale-prefix routing
- Routing collection name override → 0.10+ MIP
- BSON / binary-JSON support → not planned; JSON text is the spec channel
- USPTO trademark filings → process item, not spec
- `mosaic-explorer` separate repo → 0.11+ work
- `mosaic-edge` / `@mosaic/db` → post-1.0
- `mosaic-site` dogfood → 0.11+

---

## What 0.9 actually ships

When 0.9-realignment merges to main:

- 7 of 8 truths in PRINCIPLES.md (8th open on frontmatter)
- Renamed/restructured docs at root (PRINCIPLES, SPEC, CHANGELOG, CONTRIBUTING, AGENTS, V1)
- Archived 0.8.1 docs in `archive/0.8.1/`
- Skills folder with 5 process workflows + MIP template
- CHANGELOG reconstructed back to 0.0 with placeholders for pre-0.7
- License + trademark + NOTICE + SECURITY (already live on main via PR #2)
- Mosaic CHANGELOG entry for 0.9

What 0.9 does NOT ship:
- SPEC.md rewrite to reflect cascade + unified refs + x- + new philosophy (deferred to 0.10 because of size)
- `tools/` → `packages/` rename (deferred to 0.10)
- `record` → `entry` rename (deferred to 0.10 if still wanted)
- 100-site test corpus (running as background work)

---

## Open answers to your latest questions

**Q: What is BSON, and is it useful for us?**
A: BSON = Binary JSON. It's how MongoDB stores documents internally. Faster to parse than text JSON because it's binary. Includes types JSON doesn't (Date, ObjectId, Binary). Not useful for Mosaic spec — Mosaic's design is filesystem-native + human-readable. Binary formats break the "open in any text editor" principle. Engines that want fast in-memory representation can parse JSON to whatever internal shape they want; that's an implementation choice. BSON does NOT belong in Mosaic spec.

**Q: Should `core` be in the spec?**
A: No (locked). Spec defines what's a valid Mosaic site. `@mosaic/core` is one reference implementation. Other engines (Go, Rust, etc.) should be free to reimplement without needing to vendor our JS code. The CLI and validator might reasonably ship with the spec repo as canonical-reference implementations, but `core` as a library is just one engine option.

**Q: Should you NEED CLI to make the index?**
A: No. Index is an engine OUTPUT, not a spec REQUIREMENT. Engines emit it. CLI provides a way to emit it from a folder. Hand-authoring is possible (you'd write the same JSON the CLI would). Spec documents the index shape (§7) so any tool can emit/consume it. Not required for spec validation — spec defines folder rules; index is downstream.

**Q: MosaicDB on R2 or general?**
A: General. `@mosaic/db` should be filesystem-backed where "filesystem" can be local FS, R2, S3, or any path-keyed storage. R2 is one deployment target. Future product, not 0.9.

**Q: Mermaid sucks — what do others use?**
A: See "Decision-tree visualization" section above. My recommendation: drop mermaid for decision trees. This document IS the structured plan.

---

## Cross-pollination ask (running)

A background agent is finding OSS projects similar to Mosaic in different domains (open data, ebooks, containers, audio, etc.) for cross-pollination ideas. Output landing soon — will be added to this doc when it arrives.

**Known closest analog so far: EPUB** (zip-based portable document format). Mosaic's `.mosaic` packaging follows EPUB's pattern.

---

## What to read in what order

If you have 5 minutes: Status snapshot + Philosophy (8 claims) + Open questions table.
If you have 15 minutes: above + Architecture decisions + Ecosystem.
If you have 30 minutes: full doc.

When deciding next: scan the Open questions table. Pick the ones you want to settle this week; let the rest sit until they earn attention.


---

## Cross-pollination — OSS projects in other domains (zoom-out result)

A fresh-eyes agent surveyed the OSS landscape for projects with similar STRUCTURAL shape (manifest + folder + cross-references) in non-web domains. Findings:

### Top 5 closest analogs

| Project | Domain | License | Shared with Mosaic |
|---|---|---|---|
| **OCI Image Layout** | Containers | Apache 2.0 | Directory spec with `index.json` manifest + content-addressed blobs + JSON descriptors that cross-reference each other |
| **BagIt (RFC 8493)** | Archival / digital preservation | Public domain (IETF) | Folder convention with manifest at root + `data/` payload tree + fixity refs; explicitly designed for cross-tool portability |
| **EPUB 3** | Ebooks | BSD-style (W3C) | Folder-shape (zipped) with `META-INF/container.xml` pointing at OPF manifest that wires together prose, metadata, and cross-document refs |
| **Frictionless Data Package** | Open data | MIT | `datapackage.json` at root + folders of CSV/JSON resources + schema refs + extensible profiles. Tiny core, big ecosystem |
| **STAC (SpatioTemporal Asset Catalog)** | Geospatial | Apache 2.0 | Catalog → Collection → Item JSON tree on disk; every node links to children/parents/siblings via typed `rel` refs; cascade of metadata from catalog down |

### Closest analog overall: STAC

Same shape (manifest + nested folders + JSON records + typed cross-refs + cascade/inheritance from catalog down). Same maturity arc (community spec, multiple independent implementations, pre-1.0 → 1.0 took years). Same dual concern of "spec vs engines." STAC even has the same "spec is prose, validators are separate" split Mosaic is doing.

**If you read one project end-to-end, read STAC.** Closest mirror for what Mosaic is becoming.

### Non-obvious sibling: Nix Flakes (`flake.nix` + `flake.lock`)

Different surface (code packaging), structurally identical: a manifest at the root of a folder declares inputs, refs resolve to other folder-shapes, and a lockfile pins the cascade. Specifically worth studying for how Flakes handle **ref resolution and pinning** — the hardest unsolved problem in any cross-reference system.

### Lessons Mosaic could borrow

| Source | Lesson |
|---|---|
| OCI | Pin a *canonical on-disk layout* in one short section — required dirs, file names, media-type field on every JSON. 20-line spec page that makes interop work |
| BagIt | Ship a *fixity* convention — `manifest-sha256.txt` listing every content file + checksum. Lets anyone verify a Mosaic folder hasn't bit-rotted without running an engine |
| EPUB 3 | Separate *spec core* from *profiles/extensions* explicitly. Keeps the core small as Mosaic faces pressure to absorb every collection type |
| Frictionless Data | Adopt their *Schema sub-spec* pattern — one tiny companion spec (`tableschema`) that records can opt into for field-level typing |
| STAC | Adopt *typed link relations* (`rel: parent`, `rel: child`, `rel: self`, `rel: derived_from`). Mosaic's refs probably want named relationships, not just pointers |

### 🔴 Biggest blind spot the agent flagged

**Identity and resolution of refs across folders.** Every adjacent project had to answer "what does a ref actually point at, and how do I resolve it when the target moves or the folder is copied somewhere else?"

- OCI: content-addressed digests
- BagIt: checksums
- STAC: relative + absolute URIs with `rel` types
- Frictionless: `path` with explicit relative/remote rules
- Nix Flakes: lock-pinned input refs

**Cascade answers MERGE semantics, but not IDENTITY.** If Mosaic's refs are just folder paths today, the spec is one rename away from breaking. No story yet for:
- Refs across two Mosaic folders on the same disk
- Refs in a planned R2 cloud variant where folders are distributed objects
- What happens when `team/anna` is renamed to `team/anna-k` — every ref pointing at it silently breaks

**This is a real gap.** Worth opening MIP-0016 (or whatever the next slot) to address ref identity + portability before 1.0.

### New open question added to the pile

10. **Ref identity & resolution policy** — How does `ref:team/anna` survive a rename? Should refs be path-based (current) OR identity-based (slug-stable IDs survive renames) OR content-addressed (hash-based)? Or some mix? Options:
    - **A:** Refs stay path-based; renames break refs; tooling catches via `mosaic.ref.unresolved` validation
    - **B:** Add an optional stable `$id` to every record; refs can point at `$id` OR path; engines resolve either; rename-safe
    - **C:** Full content addressing (OCI-style) — refs include a hash; immutable
    - **My recommendation:** B. Optional stable IDs, refs resolve either way. Authors who don't care use paths; authors who want rename-safety add `$id`. Path-based default for ergonomics; identity-based escape hatch for stability. Aligns with deferred MIP-0014-style locale resolution.


---

## Non-critical findings from the example-builder (to clean up in SPEC rewrite)

The 10-example agent surfaced 26 items beyond the three critical ones. Listing here so they don't fall through cracks. Each item gets a recommendation; none block 0.9 ship; all should be resolved when SPEC.md gets rewritten in 0.10.

### Friction points (judgment calls the agent had to make)

| # | Issue | Recommendation |
|---|---|---|
| F1 | `collection-list#from:` ambiguity — filesystem path vs URL? | Filesystem path. Spec says `from: "news"` means the `news/` folder, not the URL `/news` |
| F2 | Cascade override = merge or replace? | Deep merge per #2 in the deliberation pile (objects merge, arrays replace) |
| F4 | Locale tag vs sidecar marker parsing precedence | Parse `x-` prefix FIRST, then check locale; locale tags can't start with `x-` so no collision |
| F6 | DTCG `$value` / `$type` clash with our `$` reservation | Add explicit exception: `$ref`, `$asset`, `$rel`, `$value`, `$type` are reserved Mosaic+DTCG keys; other `$`-prefixed keys are illegal inside records (engine extensions use `x-`) |
| F7 | Images-as-records — where's the binary? | The binary file IS the record. The optional sibling `.json` is the metadata sidecar. Same rule as text records (the file is the record; sidecars are optional metadata) |
| F8 | Bare-MD warning code | Assign: `mosaic.record.bare-markdown` |
| F9 | Pure-MD records can't carry refs (no JSON channel) | Accept and document. If you want refs from a markdown-only record, add a JSON sidecar |
| F11 | Cascade depth varies by collection nesting | Document. Flat collections walk fewer levels; that's expected, not a bug |

### Potential bugs (spec ambiguities)

| # | Issue | Recommendation |
|---|---|---|
| B1 | Auto-link rule for folder-shape: `<dir>/index.json` + `<dir>/index.md` | Same rule: same-stem-in-same-dir auto-link. Slug is the FOLDER name; index pair compose the record |
| B2 | Reserved slug `mosaic` vs reserved filename `mosaic.json` | Reserve only `mosaic.json` at root. A page slug `mosaic` elsewhere is fine. A folder named `mosaic/` at root would be a collection — legal. The `.json` extension at root is what's reserved, not the slug |
| B3 | Bare collection-name refs like `ref:artists` | Resolves to the collection itself as a record (its `index.{json,md}` if present, else unresolved). Same rule as `ref:singleton-name` |
| B5 | Collection folder's own `index.{json,md}` | Yes, allowed. Same universal rule. The folder represents a record (the collection's landing/metadata). Pages don't have to mount it for the record to exist |
| B6 | Slug grammar restatement | Carry forward from 0.8: `^[a-z0-9][a-z0-9-]*$`. Applies uniformly to all collections including images |

### Features that need explicit "kept" or "dropped" status

| # | Feature | Status for 0.9 |
|---|---|---|
| C1 | `mosaic.json#singletons` declaration | **Dropped** (singleton concept removed; root files are records) |
| C2 | `mosaic.json#types` declarations | **Kept**. Types declare record shapes. Critical for `mosaic.field.*` validation |
| C4 | Redirects (`mosaic.json#redirects`) | **Kept**. Carried forward from 0.8 |
| C5 | `urlPattern` overrides in `collection-list` | **Kept**. Carried forward from 0.8 |
| C8 | `pages/home.*` reserved-slug | **Dropped**. `pages/index.*` is the home; `pages/home.*` is now just a normal page at `/home` (no auto-redirect). Simpler |
| C9 | Inline tokens in `mosaic.json#tokens` | **Kept**. Both inline-in-manifest AND `tokens.json` singleton work; singleton wins if both |

### Cases the agent couldn't generate

- C3: Locale-prefixed URL routing — out of scope (engine concern)
- C6: Actual binary assets — text-only exercise; needs real binary files for full coverage
- C7: `mosaic.title.dead-h1` warning — needs an H1+JSON-title combo example

These are minor coverage gaps in the 10-site corpus, not spec bugs. Fix when expanding to 100+ sites.

---

## Items from your earlier-start thoughts (in case they got clipped)

If anything from the top of your message thread got lost, here's a memory aid of topics I noticed you raise this session that ARE captured somewhere:

- Versioning history (0.0 bucket → 0.5 Mosaic landed) — CHANGELOG placeholders waiting your fill
- "Session = step" versioning rule — CONTRIBUTING + AGENTS
- Skills folder for paperwork workflows — `skills/`
- Single-vs-dual repo for mosaic-explorer — separate repo decision, locked
- BSON / image compression questions — STATE.md "open answers"
- Frontmatter "soft" vs "hard" — STATE.md philosophy claim #4
- Mosaic-on-R2 DB engine — STATE.md ecosystem section
- Ref grammar unification (drop `asset:`, three anchors) — STATE.md architecture A6
- Cascade as universal override mechanism — STATE.md philosophy claim #7
- Pages as just-a-collection — STATE.md philosophy claim #6
- File-vs-folder name collision rule — STATE.md philosophy claim #3
- "Folder is the website" axiom — STATE.md philosophy claim #1
- Trademark + licensing protection — live on main, PR #2
- Decision-tree visualization — STATE.md alternatives section, mermaid retired

If you remember a specific thought that ISN'T in this list, say it and I'll add it.

