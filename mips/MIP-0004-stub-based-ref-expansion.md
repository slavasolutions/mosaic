# MIP-0004: Stub-based ref expansion

- **Status:** shipped (0.7)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.7

## Summary

Refs are not eagerly inlined when an engine produces the index. Each ref becomes a stub object containing `$ref`, `url`, and `title`. Engines may offer explicit dereference operations, but stubs are the wire format.

## Motivation

Records can reference each other in cycles (A → B → A). An eager inliner either loops forever, requires a depth limit, or produces inconsistent output depending on traversal order. None of these are good defaults for a portable spec.

A stub format gives consumers everything they need to render a link or follow the ref on demand, costs almost nothing in payload size, and makes circular refs a non-issue at the spec level.

## Specification

See SPEC.md §6.6 and §6.7.

Every ref in the produced index is replaced with:

```json
{ "$ref": "<address>", "url": "<url-or-null>", "title": "<resolved-title>" }
```

Refs with selectors gain a `selector` field. Engines may add fields. Consumers must tolerate unknown fields.

## Rationale and alternatives

**Option A: always lazy strings.** Index keeps the literal `"ref:team/anna"` string. Consumers do their own lookup. Rejected — every consumer reimplements ref resolution, which defeats the point of producing an index.

**Option B: eager with depth limit.** Inline the target up to depth N. Rejected — depth N is a magic number, output depends on traversal order, and different engines would pick different defaults, breaking portability.

**Option C (chosen): stubs.** Resolve enough to render a link (URL + title), no more. Consistent across engines, no recursion possible, predictable payload size.

## Drawbacks

Templates that want deep data must follow stubs in a second pass. Mitigated by the index being O(1) lookup; following a stub is one hash lookup.

## Open questions

Whether engines should be permitted to expose an "expand" operation that walks the index with author-controlled depth. Not normative; left to engines.

## Resolution

Shipped in 0.7.
