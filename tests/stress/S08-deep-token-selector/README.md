# S08 — Deep token selector

## Setup

`tokens.json` with `color.brand.primary.shade-500` (4-level DTCG nesting). A page refs it via `ref:tokens@color.brand.primary.shade-500`.

## Spec

§5.6 says dot-path selectors. §10.3 says token refs resolve to the `$value`.

## Expected

Resolves clean, ref→stub→value chain works.

## Spec gap (small)

The selector grammar in §5.2 says segments match `[a-z0-9_-]+`. `shade-500` qualifies. But what about hyphens at the boundary (e.g. `-500-`)? Edge case, probably fine — trim before regex. Worth a one-line clarification.
