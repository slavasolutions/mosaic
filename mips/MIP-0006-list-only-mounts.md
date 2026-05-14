# MIP-0006: List-only mounts via `routes: false`

- **Status:** shipped (0.7)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.7

## Summary

A `collection-list` section may set `"routes": false` to display a collection's records without minting detail URLs. Useful for homepages and previews that should not claim ownership of detail routes.

## Motivation

Surfaced while writing conformance test 017. The original §4.2 said a page mounting a collection MUST mint a route per record using the default `<page-url>/{slug}` pattern. This created a problem: a homepage that mounts `collections/news` for "latest 3" would mint `/news-item-1`, `/news-item-2`, etc. at the root, while `/news` would also try to mint `/news/news-item-1`. Two URLs per record, route collision.

Authors had two ugly workarounds: (a) set `urlPattern` to the same pattern the canonical mount uses, hoping the engine deduplicates, or (b) avoid showing the collection on any page that isn't its canonical home. Neither is clean.

`"routes": false` cleanly separates listing from routing.

## Specification

See SPEC §4.2 and §5.1.

- Default: `"routes": true`. Mount lists records and mints detail routes.
- `"routes": false`. Mount lists records only; another page is expected to handle detail routes.
- Engines MUST NOT report a collision for a `routes: false` mount.
- A collection MAY have only `routes: false` mounts; in that case its records are unrouted (per §4.4).
- If multiple `routes: true` mounts produce identical URLs for the same record, engines mint the route once (not a collision).

## Rationale and alternatives

**Considered: implicit deduplication.** Engines could just dedupe routes when different mounts happen to agree. Rejected — silent behavior, and breaks down when the default pattern produces different URLs (e.g. homepage `/` vs landing `/news`).

**Considered: a separate section type, `collection-preview`.** Rejected — duplicates almost all the fields of `collection-list`, more surface area, less obvious to authors.

**Considered: name the field `mintRoutes`.** Rejected — `routes` is shorter and reads naturally.

## Drawbacks

One more field on `collection-list`. Default is `true` so existing sites don't break.

## Open questions

None.

## Resolution

Shipped in 0.7.
