# S03 — Folder vs direct, same slug

## Setup

`collections/team/anna.json` (direct) AND `collections/team/anna/index.json` (folder). Both claim slug `anna`.

## Spec gap

§2.2 lists two valid locations for a record but doesn't say what happens when both exist for the same slug.

For pages, the current validator emits `mosaic.route.collision` (since two records would route to the same URL). For collections, it's less obvious — collections aren't routed until a page mounts them, so the collision is "internal" to the collection.

## Recommendation

Treat folder-and-direct-with-same-slug as a structural error: `mosaic.slug.duplicate`. The folder shape implies "this record has assets co-located"; the direct shape implies "no assets needed." A single slug can't have both stories.

**MIP candidate:** MIP-0015 — slug uniqueness across shapes.

The current validator (per its source) reports this as `route.collision` only for pages. For collections, behavior is undocumented.
