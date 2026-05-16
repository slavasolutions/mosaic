# tokens-and-refs

Root `tokens.json` in DTCG shape. Multiple records reference tokens via `ref:tokens@<path>`.

## What this tests

- DTCG-shaped tokens at root as an ordinary record (`tokens.json`, no `singletons` declaration in `mosaic.json`)
- Refs into the token tree from:
  - `site.json#accent_color` → `ref:tokens@color.accent`
  - `pages/index.json#hero.*` → four refs into `color.*` and `font.display`
  - `pages/catalogue.json#tag_color` → `ref:tokens@color.muted`
  - `books/the-quiet-room.json#cover_accent` → `ref:tokens@color.accent`
- Cascade-default anchor: bare `ref:tokens@…` walks parent chain from the consumer's location and finds `tokens.json` at root.

## Friction noticed

1. **Selector grammar.** The 0.9 brief locks "one `ref:` grammar with three anchors" but doesn't explicitly carry forward the `@selector` syntax from 0.8. I am assuming `@<dot-path>` is part of the same grammar (since DTCG addressing needs it). If selectors were dropped, this example is broken; if they were kept, the brief should say so.

2. **DTCG payload preservation.** The token record has `$value` and `$type` keys with dollar prefixes. The 0.8 spec uses `$<ns>` for engine extensions; the 0.9 brief moves to `x-<ns>`. DTCG's `$value` and `$type` are external standard keys, not Mosaic extensions — so the engine must allow `$` keys inside `tokens.json` but reject (or warn on) `$ns.foo` patterns elsewhere. This is a real ambiguity once `$` is no longer the extension marker.

## Expected behavior

A renderer should resolve `ref:tokens@color.accent` to the string `#a8324a`. Whether the stub form preserves both the address and the resolved value, or just the resolved value, is engine-defined per the brief.

## Expected route table

- `/` → home
- `/catalogue` → catalogue list
- `/catalogue/the-quiet-room`
- `/catalogue/last-train-from-madras`
