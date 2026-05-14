# S01 — Empty pages folder

## Setup

A site with `pages/index.md` and `pages/section-with-no-content/` (a folder with NO `index.md` or `index.json` inside).

## Question

What should the engine do with an empty page folder?

Two readings of SPEC §2.2:
- The folder is a **folder-shape record** missing its required `index.{md,json}`. That's a `mosaic.record.empty` structural error.
- The folder isn't a record at all — it has no `index.*`, so it doesn't satisfy the spec's "folder shape" definition, so the engine ignores it silently.

The 0.8 validator currently emits `mosaic.record.empty` (first reading). Defensible but the spec doesn't explicitly pick.

## Spec gap

§2.2 says a folder-shape record is "a directory whose name is the slug, containing `index.md`, `index.json`, or both." The negative case isn't covered. Pick a reading:

**Recommendation:** Treat an empty folder (or a folder with no `index.*`) as **ignored**, not a record. Reason: empty folders accumulate naturally (`mkdir` artifacts, scaffolding leftovers); flagging them as structural prevents authors from staging work-in-progress slugs.

**MIP candidate:** MIP-0014 — folder-shape preconditions.
