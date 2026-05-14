# Mosaic Improvement Proposals (MIPs)

The spec changes through MIPs. A MIP is a numbered document that proposes one change, captures the discussion, records the decision, and lives in this directory forever.

## When you need a MIP

You need a MIP to:

- Add a new ref form, section type, top-level directory, or singleton convention
- Change resolution rules, routing rules, or precedence
- Reserve filenames, characters, or syntax
- Add or remove a tool from the v1 list with normative behavior
- Add or change a load-bearing rule in `TRUTHS.md`

You do not need a MIP to:

- Fix typos or clarify wording in the spec
- Add examples or tests
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

| Number   | Title                                       | Status        |
|----------|---------------------------------------------|---------------|
| MIP-0001 | Folder layout and record shapes             | shipped (0.7) |
| MIP-0002 | Ref grammar and selectors                   | shipped (0.7) |
| MIP-0003 | Collection routing                          | shipped (0.7) |
| MIP-0004 | Stub-based ref expansion                    | shipped (0.7) |
| MIP-0005 | Three-level validation severity             | shipped (0.7) |
| MIP-0006 | List-only mounts via `routes:false`         | shipped (0.7) |
| MIP-0007 | Root-level singletons                       | shipped (0.8) |
| MIP-0008 | mosaic.json as full manifest                | shipped (0.8) |
| MIP-0009 | Writers preserve unknown fields             | shipped (0.8) |
| MIP-0010 | Required-title uses the resolved value      | shipped (0.8) |
| MIP-0011 | Design tokens as a root singleton           | shipped (0.8) |
| MIP-0012 | Redirects                                   | shipped (0.8) |
| MIP-0013 | Home is `/`                                 | shipped (0.8) |
| MIP-0014 | First-class locales                         | shipped (0.8.1) |

Shipped MIPs are kept for historical record. The current state of the spec is in `spec/SPEC.md`; MIPs are the trail of how it got there.

The 0.7 MIPs (0001–0006) defined the folder-shape baseline. The 0.8 MIPs (0007–0013) close interop holes (0009, 0010), expand `mosaic.json` into a real manifest (0007, 0008), and add the three first-class features 0.7 deferred: design tokens (0011), redirects (0012), and the home route lock (0013). The 0.8.1 MIP (0014) promotes localization out of engine extensions and into the base spec.
