# MIP-NNNN: <Short Title>

| Field | Value |
| --- | --- |
| **Number** | NNNN |
| **Title** | <Short title> |
| **Author(s)** | <Name> (<@handle>) |
| **Status** | Draft |
| **Created** | YYYY-MM-DD |
| **Target spec version** | 0.X |
| **Supersedes** | (none, or MIP-NNNN) |
| **Superseded by** | (none, or MIP-NNNN) |

## Summary

One paragraph. What does this MIP propose? Pretend you're explaining it to someone who's never read the spec.

## Motivation

What real problem does this solve? Who hit it? In which implementation?

If the answer is "hypothetically a renderer might want..." or "it would be nice if...", this MIP is probably not ready. Wait until someone actually hits the problem.

If only the reference implementation needs this, explain why it can't live in the engine documentation instead.

## Proposed change

The actual spec text. Write it diffable against the current `spec.md`. Use RFC 2119 keywords for normative claims.

If this MIP adds a new section, write the full section here. If it modifies an existing section, show the before-and-after.

If this MIP adds new fields to existing structures, show how they integrate with the surrounding context.

## Alternatives considered

What else did you think about? Why is this proposal better than each alternative?

At minimum, consider:

- Doing nothing. What breaks if this MIP is rejected?
- Implementing this in the engine instead of the format. Why does it need to be in the portable surface?
- A simpler version that solves 80% of the problem. Why is that not enough?

## Backward compatibility

Does this break any existing valid Mosaic documents?

- If no: explain why not.
- If yes: describe the migration story. What does a v0.X reader do when it encounters a v0.X+1 document that uses this feature? What does a v0.X+1 reader do with a v0.X document?

Unknown-field preservation (`spec.md` §9.3) makes most additive changes backward-compatible. If your change is additive, confirm this explicitly.

## Reference implementation status

Has anyone built this? Where?

- "Implemented in Clear's `<package>` since `<commit>`" — strong.
- "Prototyped in <branch>; not merged" — moderate.
- "Not yet implemented" — usually a signal to defer.

The MIP can still be accepted with no implementation, but the bar is higher.

## Open questions

List anything you don't have a clean answer for. Reviewers will help work through them.

## Decision log entry

When this MIP is accepted, this entry will be added to `spec.md` Appendix F:

| ID | Decision | Reasoning |
| --- | --- | --- |
| **D-N** | <one-line decision> | <one-line reasoning> |

## References

- Related issues, prior MIPs, external prior art (other format specs that solved this), implementation PRs.
