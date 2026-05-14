# S11 — Trailing slash on collection-list `from`

## Setup

`from: "collections/notes/"` (with trailing slash).

## Spec gap (LOW PRIORITY)

§3.3 example shows `"from": "collections/news"` (no trailing slash). Spec doesn't say whether engines must normalize.

## Reading

Validator currently strips trailing slash silently. Reasonable default.

## Recommendation

Spec text in §3.3: "The `from` value MUST NOT include a trailing slash. Engines SHOULD normalize by stripping one if present, but MAY treat it as `mosaic.collection.missing`."

**MIP candidate:** Not worth a MIP; a one-line spec clarification suffices.
