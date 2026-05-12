# invalid/list-impossible-bounds

A `list` slot whose `min` (5) exceeds its `max` (3). No content can satisfy both — every list value will fail one bound or the other.

## Spec reference

§4.5 — `list` slot type-specific fields: `min: number`, `max: number`. Spec does NOT explicitly forbid `min > max`.

§6 — Section is invalid if "A `list` slot's length is outside `[min, max]`".

## Expected outcome

| Check | Outcome | Why |
| --- | --- | --- |
| JSON Schema fast-path | PASSES | Schema doesn't currently encode the `min <= max` cross-property constraint |
| Spec-text validation | should FAIL at the schema-declaration step (§4.5) | The SlotDef is internally inconsistent; every value would fail §6 |

## Why this matters

The spec lets impossible declarations sit silently in `mosaic.json`. Either:

1. `mosaic.schema.json` should add a cross-property constraint (`if min and max present, min <= max`) — JSON Schema 2020-12 supports this via `dependentSchemas` or `allOf` + `if/then`.
2. Or §4.5 should add a "validators MUST reject SlotDefs with `min > max`" clause.

## MIP candidate

**"Add bounded-pair validation for `list.min` / `list.max` (and `number.min` / `number.max`)."** Same pattern applies to the `number` slot type.
