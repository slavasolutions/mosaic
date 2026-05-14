# Mosaic Improvement Proposals (MIPs)

The spec changes through MIPs. A MIP is a numbered document that proposes one change, captures the discussion, records the decision, and lives in this directory forever.

## When you need a MIP

You need a MIP to:

- Add a new ref form, section type, or top-level directory
- Change resolution rules, routing rules, or precedence
- Reserve filenames, characters, or syntax
- Add or remove a tool from the v1 list with normative behavior

You do not need a MIP to:

- Fix typos or clarify wording in the spec
- Add examples
- Improve tooling that doesn't change observable behavior

## MIP lifecycle

```
draft  →  proposed  →  accepted  →  shipped
                 ↘                ↗
                  rejected / withdrawn
```

- **draft** — being written, not yet up for discussion
- **proposed** — open for review, gathering feedback
- **accepted** — decision made, awaiting implementation in a spec release
- **shipped** — merged into a spec version (record which one)
- **rejected** — decided against, kept on file for posterity
- **withdrawn** — author pulled it before a decision

## Numbering

MIPs are numbered sequentially: `MIP-0001`, `MIP-0002`, etc. Numbers are never reused. Filenames are `MIP-NNNN-short-title.md`.

## MIP structure

Every MIP has the same sections, in order:

```markdown
# MIP-NNNN: Title

- **Status:** draft | proposed | accepted | shipped | rejected | withdrawn
- **Author:** name
- **Created:** YYYY-MM-DD
- **Target version:** 0.x

## Summary

One paragraph. What changes.

## Motivation

Why. What problem this solves.

## Specification

The normative change. Written as if it were going into SPEC.md verbatim.

## Rationale and alternatives

Why this design over others. What was considered and rejected.

## Drawbacks

Honest list of costs.

## Open questions

Anything unresolved.

## Resolution

Filled in at acceptance/rejection. Records who decided, when, and why.
```

## Current MIPs

| Number   | Title                            | Status   |
|----------|----------------------------------|----------|
| MIP-0001 | Folder layout and record shapes  | shipped (0.7) |
| MIP-0002 | Ref grammar and selectors        | shipped (0.7) |
| MIP-0003 | Collection routing               | shipped (0.7) |
| MIP-0004 | Stub-based ref expansion         | shipped (0.7) |
| MIP-0005 | Three-level validation severity  | shipped (0.7) |
| MIP-0006 | List-only mounts via routes:false | shipped (0.7) |

Shipped MIPs are kept for historical record. The current state of the spec is in `spec/SPEC.md`; MIPs are the trail of how it got there.
