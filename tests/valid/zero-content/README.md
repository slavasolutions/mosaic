# valid/zero-content

The minimal valid Mosaic document: `meta` + empty `blockTypes` + empty `collections`, no `content/`, no `assets/`, no other directories.

## Spec reference

§3.1 — "A Mosaic document with `mosaic.json` containing valid `meta` + empty `blockTypes: {}` + empty `collections: {}`, and no `content/` or `assets/` directories, IS conformant. Pages are not REQUIRED. This is the minimal valid Mosaic document."

## Expected outcome

| Check | Outcome |
| --- | --- |
| JSON Schema fast-path | PASSES |
| Spec-text validation | PASSES |

## Why this matters

Format specs that lack a documented minimal valid example are surprising for implementers. This case is the empty-state regression test. If any implementation fails on this, the implementation is wrong.
