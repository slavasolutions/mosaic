# MIP-0002: Ref grammar and selectors

- **Status:** shipped (0.7)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.7

## Summary

Define four ref forms — `ref:`, `asset:`, `./`, and the `@selector` suffix — and their resolution semantics.

## Motivation

Records cross-reference each other. Without a uniform addressing scheme, every engine invents its own and sites stop being portable.

## Specification

See SPEC.md §6.

Four forms:
- `ref:<address>` — addresses a record by collection + slug or `globals/<name>`
- `asset:<path>` — addresses a binary asset under `images/`
- `./<path>` — relative to the JSON file that contains it; only valid inside record JSON
- `@<selector>` — suffix on `ref:` or `./` that selects a sub-part of the resolved record

Selectors:
- JSON targets: dot-path into the resolved JSON
- Markdown targets: heading slug
- Records with both: JSON path wins, falls back to markdown

## Rationale and alternatives

**Why `@` for selectors, not `#`?**

Considered: `#` (URL-fragment convention). Rejected — author preference; the word "fragment" carries web-spec baggage and the symbol invites that vocabulary back in. `@` reads naturally aloud ("anna at title"), has no collision with URL semantics, and visually distinguishes the selector from a slug.

Considered: `.` (JS-style property access). Rejected — visually merges with slugs containing dots.

Considered: `::` (Rust/C++ namespacing). Rejected — two characters for one job; ergonomically worse.

**Why call it a selector, not a path?**

A path implies filesystem. A selector implies "the part of the thing you're selecting." Works for both JSON and markdown without leaking implementation details.

**Why shape-agnostic resolution?**

A ref like `ref:team/anna` should work whether anna is a single file or a folder. Forcing callers to know the shape would couple every reference to filesystem details and prevent migrating between shapes.

## Drawbacks

Three separate forms (`ref:`, `asset:`, `./`) is more surface area than one. Considered unifying — rejected because relative refs need a different resolution context (the JSON file's location) than absolute refs (the site root).

## Open questions

None.

## Resolution

Shipped in 0.7.
