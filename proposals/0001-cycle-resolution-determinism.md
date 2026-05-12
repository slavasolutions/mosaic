# MIP-0001: Cycle resolution determinism (§7.4)

| Field | Value |
| --- | --- |
| **Number** | 0001 |
| **Title** | Cycle resolution determinism (§7.4) |
| **Author(s)** | slavasolutions/mosaic maintainers |
| **Status** | Accepted |
| **Created** | 2026-05-12 |
| **Target spec version** | 0.6 |
| **Supersedes** | (none) |
| **Superseded by** | (none) |

## Summary

§7.4 says circular references MUST be detected and one side returned as `kind: "record"`, the other as `kind: "ref-cycle"`. It does NOT specify which side becomes which. Two conformant implementations can produce different results for the same document. This MIP makes the assignment deterministic via depth-first walk order from the resolution entry point, extends the rule from 2-cycles to N-cycles + self-cycles, and adds explicit conformance language that two resolvers given the same input MUST produce the same `record`-vs-`ref-cycle` assignment.

## Motivation

The stress-test case `tests/edge-cases/circular-refs/` surfaced the ambiguity. The current §7.4 text:

> "If A.slot refs B, and B.slot refs A: the resolver MUST detect the cycle and return one ref as `kind: 'record'` with full data, the other as `kind: 'ref-cycle'` with just `{ kind, ref }`. MUST NOT infinite-loop."

The word "one" is unspecified. Two conformant resolvers handed the same document with a cycle can disagree on which side gets expanded. That defeats Mosaic's core portability guarantee — that any two conformant readers produce the same understanding of the document.

Additionally, current §7.4 only addresses 2-cycles. Longer cycles (A → B → C → A) and self-cycles (A.slot refs A) are not explicitly covered, leaving implementations to extend by analogy or not at all.

## Proposed change

Replace §7.4 with:

> ### 7.4 Circular references
>
> Reference resolution walks the document depth-first starting from the **resolution entry point** — the record currently being resolved at the top of the call stack (typically a page record being rendered or a collection record being processed). Validators with no natural entry point MAY pick any record as entry point provided the choice is deterministic for that validator run.
>
> When the walk encounters a cycle:
>
> 1. The first time a record is reached during a resolution walk, it MUST be returned as `kind: "record"` with full data.
> 2. Any subsequent reference to that same record during the same resolution walk MUST be returned as `kind: "ref-cycle"` with just `{ kind, ref }`.
>
> This rule applies uniformly to:
>
> - **2-cycles** — A.slot refs B, B.slot refs A
> - **N-cycles** — A → B → C → ... → A for any N ≥ 2
> - **Self-cycles** — A.slot refs A directly
>
> Resolvers MUST NOT infinite-loop. Two conformant resolvers given the same document and the same entry point MUST return the same `record`-vs-`ref-cycle` assignment across all references in the walk.

## Alternatives considered

1. **Do nothing.** Both implementations agree the cycle is detected and one side becomes `record`. Most documents don't have cycles. But portability fails when a document does have a cycle: different renderers produce different outputs. Rejected — defeats the spec's portability promise in the exact cases where cycle handling matters.
2. **Leave determinism to engines, document per-engine.** Engines could document their own behavior. But the spec promises any two conformant readers produce the same understanding. That promise must hold for cycles too. Rejected.
3. **Always return `ref-cycle` for both sides.** Simpler. But loses information: in a 2-cycle the consumer cannot retrieve either record's data. Hostile to common cases (related-posts where a cycle is an editorial accident, not intent). Rejected.
4. **Specify breadth-first instead of depth-first.** Equivalent determinism guarantee. Depth-first matches typical resolver implementations (recursive descent) and matches how renderers typically walk page records into refs. Choosing depth-first matches the implementation patterns Clear and other CMS engines already use; switching to breadth-first would create unnecessary churn. Rejected for ergonomic reasons.

## Backward compatibility

This MIP tightens existing behavior; it does not make any previously-valid document invalid.

- A v0.5 document with cycles is also a v0.6 document with cycles.
- Conformant v0.5 readers handling such documents MAY have produced either side as `record`; conformant v0.6 readers MUST produce a deterministic side.
- Practical implication: implementations may need to add walk-order tracking (visited-set during recursion). The change is small.

Unknown-field preservation (§9.3) is not affected.

## Reference implementation status

The Clear engine's `@clear/render/src/resolve.mjs` currently performs depth-first cycle detection but the side-assignment is implicit in walk order, undocumented. Implementing this MIP in Clear is a documentation pass plus tests confirming determinism across walks starting from different entry points.

## Open questions

None blocking acceptance. Two minor questions resolved in the proposed text above:

- **Entry point definition:** the proposed text names it ("the record currently being resolved at the top of the call stack") and gives validators (which lack a natural entry point) a deterministic-choice escape hatch.
- **Self-cycle handling:** explicitly covered. A.slot refs A returns the record on first reach; if the resolver later re-encounters A via its own slot during the same walk, that re-encounter is `ref-cycle`.

## Decision log entry

When accepted, this entry is added to `spec.md` Appendix F:

| ID | Decision | Reasoning |
| --- | --- | --- |
| **D-16** | Make §7.4 cycle resolution deterministic via depth-first walk from the entry point; cover N-cycles and self-cycles; mandate two conformant resolvers produce the same assignment. | Stress-test discovery (`tests/edge-cases/circular-refs/`) found "one as record, the other as ref-cycle" was ambiguous: two conformant resolvers could disagree on the same document. Determinism preserves the portability guarantee. |

## References

- `tests/edge-cases/circular-refs/` — stress test surfacing the ambiguity
- `spec.md` §7.4 (pre-MIP) — original two-side text
- `spec.md` §9.3 — unknown-field preservation (unaffected by this MIP)
