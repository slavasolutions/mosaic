# edge-cases/circular-refs

Two blog records that reference each other. A → B → A. Spec specifies cycle detection but the resolved data shape is partly underspecified.

## Spec reference

§7.5 — "If A.slot refs B, and B.slot refs A: the resolver MUST detect the cycle and return one ref as `kind: "record"` with full data, the other as `kind: "ref-cycle"` with just `{ kind, ref }`. MUST NOT infinite-loop."

## Edge questions

1. **Which side wins?** Spec says "one as record, the other as ref-cycle" — but doesn't say WHICH. If a reader starts resolving from A, is A the "record" and B the "ref-cycle"? Is the answer always deterministic across implementations? Two impls starting from different entry points could produce different shapes for the same document.

2. **Three-cycle (A → B → C → A)?** Spec language only addresses A ↔ B. What's the contract for longer cycles? Is the first-walked one the "record" and the other two `ref-cycle`? Are middle nodes (B, C) records and only A's repeat is `ref-cycle`?

3. **Self-cycle (A → A)?** §7.5 doesn't mention. Probably the same answer (return one as record, never re-walk), but should be said explicitly.

## Candidate behavior

**Document-walk determinism:** the FIRST ref-string encountered during a recursive walk from the entry point resolves as `kind: "record"`; every subsequent ref to an already-walked record resolves as `kind: "ref-cycle"`. This makes the result deterministic given a known entry point.

For multi-entry-point scenarios (e.g. RSS feeder walking all blog records), the entry point is implementation-defined but each walk is internally deterministic.

## MIP candidate

**"Clarify §7.5 — cycle resolution determinism and N-cycles."** Spec text should:

1. Define "walk order" explicitly (depth-first from a named entry point).
2. State that the first-walked instance is the `record`, subsequent walks are `ref-cycle`.
3. Extend the rule from 2-cycles to N-cycles.
4. Cover self-cycles.
