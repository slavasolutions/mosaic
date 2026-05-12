# invalid/locales-missing-default

`i18n.locales` doesn't include `defaultLocale`. Self-contradictory configuration: the spec says `locales` must include `defaultLocale`, but this case violates that.

## Spec reference

§4.8 — `"locales": ["en", "fr", "es"], // REQUIRED, includes defaultLocale`

The parenthetical "includes defaultLocale" is the constraint. `mosaic.schema.json` does NOT currently encode this cross-property check (JSON Schema can express it via `contains` / custom keyword, but the shipped schema doesn't).

## Expected outcome

| Check | Outcome | Why |
| --- | --- | --- |
| JSON Schema fast-path | PASSES | Cross-property constraint not encoded |
| Spec-text validation | should FAIL at §4.8 | `defaultLocale` is "en", but "en" is not in `locales: ["fr", "es"]` |

## Why this matters

Same shape as `list-impossible-bounds`: the spec text states a constraint, the schema doesn't enforce it, runtime validation has to catch it. If we want the schema to be a real fast-path, this is encodable.

## MIP candidate

**"Add cross-property validation for `i18n.defaultLocale` ∈ `i18n.locales`."** Could land alongside the bounded-pair MIP as one "fast-path completeness" proposal.
