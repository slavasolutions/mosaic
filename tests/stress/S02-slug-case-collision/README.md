# S02 — Slug case collision

## Setup

`collections/things/foo.json` and `collections/things/Foo.json` — same slug differing only in case.

## Spec

§2.5: "Two records whose slugs differ only in case are a conflict (`mosaic.slug.case`)." Plus the slug regex `^[a-z0-9][a-z0-9-]*$` makes `Foo` invalid by itself (uppercase `F`).

So two diagnostics fire:
1. `mosaic.slug.invalid` on `Foo` (regex violation)
2. `mosaic.slug.case` on the case collision

The current validator emits the regex violation first and continues. Does it also emit the case collision? Let's see.

## Why this matters

If the validator stops at `slug.invalid`, case-collision detection is incidental. If it continues, both fire. The spec says both rules apply but doesn't say their ordering. Worth pinning.
