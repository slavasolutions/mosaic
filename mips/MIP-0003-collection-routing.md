# MIP-0003: Collection routing

- **Status:** shipped (0.7)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.7

## Summary

Collections are not routed on their own. A page in `pages/` declares routing for a collection via a `collection-list` section. The default URL pattern is `<page-url>/{slug}`.

## Motivation

Routing is a presentation concern. A `news` collection might appear at `/news` on one site and `/journal` on another, with different sort orders, limits, and filters. Coupling routes to collection definitions makes collections non-portable. Decoupling them keeps content pure data.

## Specification

See SPEC.md §4.2 and §5.1.

A page declares routing by including a `collection-list` section in its JSON. The section must specify `from` (the collection path). Other fields are optional with documented defaults. The default `urlPattern` is `<page-url>/{slug}`; explicit override is allowed.

The same collection may be mounted by multiple pages with different configurations. Collisions are reported as structural errors.

## Rationale and alternatives

**Why declare routing in pages, not collections?**

Considered: collections self-declare their route. Rejected — the same collection can't have multiple routes, and the routing decision belongs with the page that presents the listing.

**Why default the URL pattern?**

99% of cases are `<page-url>/{slug}`. Making authors write that field explicitly is friction without value. Override remains available for the 1%.

**Why `{slug}` as the only required variable?**

Slug is the minimum needed for uniqueness. `{date}`, `{year}`, etc. are engine extensions in 0.7; they may become normative later.

## Drawbacks

A reader looking at `collections/news/` cannot tell, from the collection alone, whether or where its records are routed. They must look at `pages/` to find the mount. This is the price of decoupling and is mitigated by the index, which makes routes queryable.

## Open questions

Whether to support `{year}`, `{month}`, and other date-derived variables normatively. Deferred to a future MIP.

## Resolution

Shipped in 0.7.
