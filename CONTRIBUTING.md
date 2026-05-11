# Contributing to Mosaic

Mosaic is a portable document format. The spec is the product. Changes to the spec are how the format evolves.

This document covers how to propose changes, file bugs, and contribute examples.

## What kind of change are you making?

**A bug or ambiguity in the spec text** (typo, contradiction, unclear phrasing that doesn't change behavior) — open a PR directly. No MIP needed. Title it `spec: clarify §X.Y` or `spec: fix typo in §X.Y`.

**A normative change** (anything that changes what readers or writers MUST/SHOULD do, anything that adds or removes a feature, anything that affects whether a document is conformant) — open a MIP. See below.

**A new example or example improvement** — open a PR directly. Examples live in `examples/` and are document-only (no rendered output, no engine-specific code).

**A new implementation** — open a PR adding a row to the implementations table in `README.md`. Your implementation doesn't need to be hosted in this repo or this org.

**A question or discussion** — open a GitHub issue with the `question` label. If discussion converges on a proposed change, the next step is a MIP.

## Mosaic Improvement Proposals (MIPs)

Every normative change to the spec lands as a MIP first. The spec edit is a separate PR that references the accepted MIP.

### Why this matters

The spec describes a file format. Every feature in the format is a thing that every reader and writer might have to implement, and every document on disk depends on. Casual additions don't stay casual — they become permanent surface area. The MIP process makes the cost of additions visible and forces evidence-based decisions about what belongs in the portable surface vs. an engine.

### MIP lifecycle

1. **Discussion.** Open a GitHub issue describing the problem, not the solution. Tag it `mip-discussion`. Get rough agreement that there's something worth solving.
2. **Draft.** Copy `proposals/template.md` to `proposals/NNNN-short-name.md` where NNNN is the next available number. Fill it in. Open a PR.
3. **Review.** Reviewers focus on: does this belong in the portable format or in an engine? Is the motivation evidence-based? Who's the second implementer who needs this? Are alternatives considered?
4. **Decision.** Status moves to one of:
   - **Accepted** — merge the MIP. Spec edits land in a separate PR.
   - **Rejected** — merge the MIP with status Rejected and reasoning preserved. Rejected MIPs stay in the repo as a record.
   - **Withdrawn** — author withdraws. Same as rejected for record-keeping.
   - **Deferred** — there's interest but not enough evidence yet. Merge with status Deferred and revisit later.
5. **Implementation.** Once spec edits land, status moves to Implemented. The decision log entry is added to `spec.md` Appendix F.

### What makes a good MIP

- **Real motivation.** "Implementation X hit problem Y and worked around it by Z" is good motivation. "It would be nice if..." is not.
- **Concrete normative text.** A MIP should include the actual spec language being proposed, diffable against the current spec.
- **Alternatives considered.** What else did you think about? Why is this better?
- **Backward compatibility analysis.** Does this break existing valid documents? If yes, that's a stronger bar — it needs a clear migration story.
- **Reference implementation status.** Has anyone built this? Where? If the answer is "nobody," that's usually a signal to defer.

### What makes a MIP likely to be rejected or deferred

- Sole justification is "the reference implementation needs this." The reference implementation is downstream of the spec, not the other way around. If only Clear needs it, it belongs in Clear's engine docs.
- Adds an optional feature that compounds reader behavior. Three optional features compound into eight reader behaviors. The bar for optional features is higher, not lower.
- Speculative ("a future renderer might want..."). Wait until at least one renderer actually wants it.
- Overrides a prior decision (Appendix F in `spec.md`) without addressing the original reasoning.

### Versioning

While Mosaic is in 0.x:

- New features and breaking changes can land in minor versions (0.5 → 0.6).
- Each minor version gets a release tag.
- The decision log in `spec.md` Appendix F is the canonical record of what changed and why.

When Mosaic hits 1.0:

- Semver applies.
- Breaking changes require a major version bump.
- The MIP process gets stricter about backward compatibility.

## Spec style

- Use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) in normative text. Don't invent new keywords.
- Mark non-normative sections clearly. Examples, recommendations, and recipes are non-normative.
- Use tables for closed taxonomies (slot types, position vocabulary, etc.). They're easier to validate against than prose.
- Use ABNF (RFC 5234) for grammars.
- Use JCS (RFC 8785) if you ever need canonical JSON. (v0.5 doesn't, but if a future MIP needs canonical encoding, JCS is the default.)
- Keep sentences short. The spec is read under pressure by implementers trying to figure out if their edge case is conformant.

## Code of conduct

Be civil. Disagree about ideas, not people. Reviewers are doing volunteer work; assume good faith.

If discussion gets heated, step away. The MIP process is asynchronous on purpose.

## License

By contributing, you agree that your contributions are licensed under CC0 1.0 Universal (spec text) or MIT (code), matching the existing repo license.
