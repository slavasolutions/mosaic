# Mosaic Improvement Proposals (MIPs)

Normative changes to the Mosaic spec land as MIPs before they land in `spec.md`. See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the full process.

## How to file a MIP

1. Open a GitHub issue tagged `mip-discussion` to confirm there's something worth solving.
2. Copy `template.md` to `NNNN-short-name.md` (next available number).
3. Fill it in. Open a PR.
4. Status moves through Draft → Accepted / Rejected / Deferred / Withdrawn → Implemented.

## Status meanings

| Status | Meaning |
| --- | --- |
| **Draft** | Open PR; under discussion |
| **Accepted** | Merged; spec edits pending in a separate PR |
| **Implemented** | Spec edits merged; decision log entry added to `spec.md` Appendix F |
| **Rejected** | Merged with status Rejected; reasoning preserved as record |
| **Deferred** | Interest exists, but evidence isn't strong enough yet; revisit later |
| **Withdrawn** | Author withdrew before decision |
| **Superseded** | Replaced by a later MIP |

## Index

| MIP | Title | Status | Target |
| --- | --- | --- | --- |
| _(no MIPs yet)_ | | | |

When a MIP is filed, add a row here.

## Numbering

MIPs are numbered sequentially from 0001. Numbers are assigned at PR-open time. If two PRs collide on the same number, the second renames before merge.

Rejected and Withdrawn MIPs keep their numbers. Numbers are never reused.
