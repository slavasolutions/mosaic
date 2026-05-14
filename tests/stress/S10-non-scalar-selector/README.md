# S10 — Non-scalar selector target

## Setup

`ref:site@social` where `social` is an array (not a scalar).

## Spec gap (HIGH PRIORITY)

§5.6 only shows scalar examples: `contact.email`, `nav.0.label`. It's silent on whether `@social` (resolving to an array) is valid.

Three defensible readings:

1. **Allow non-scalar.** The selector resolves to whatever JSON value sits at the path — array, object, scalar, doesn't matter. Renderer/consumer decides how to handle it.
2. **Scalar only.** A selector pointing at a non-scalar value emits `mosaic.selector.non-scalar` (drift) — the author probably meant to target a sub-field.
3. **Read-twice.** Treat array targets as "give me the whole array as the stub value"; treat object targets as "give me the whole object." Same as #1 but explicit.

The current validator + renderer + astro adapter all silently allow it (reading #1). The Astro adapter specifically uses it for `ref:studio@principles` returning an array. So in practice, reading #1 is winning.

## Recommendation

Spec text: "Selector targets MAY be scalar, array, or object. The resolved value is whatever sits at the JSON path. Consumers decide how to render non-scalar values." Add `mosaic.selector.non-scalar` as an OPTIONAL warning for tools that prefer scalar selectors (drift, not structural).

**MIP candidate:** MIP-0016 — non-scalar selectors.

## Expected

0 diagnostics (reading #1 wins).
