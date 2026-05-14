# MIP-0005: Three-level validation severity

- **Status:** shipped (0.7)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.7

## Summary

Validation produces three severity levels: **structural**, **drift**, and **warning**. Structural errors block index production. Drift permits an index but is reported. Warnings are informational.

## Motivation

A Mosaic site is frequently in a transient inconsistent state during authoring — a schema field added moments before content updates, a renamed record with refs still pointing to the old slug, a deleted record still mentioned somewhere. Treating all inconsistencies as errors blocks normal work. Treating them all as warnings hides genuine breakage.

Three levels matches what authors experience: "this is broken," "this works but you should fix it," "FYI."

## Specification

See SPEC.md §7.

- **Structural:** the site cannot be built. Engine must refuse to produce an index.
- **Drift:** internally inconsistent but buildable. Engine must produce an index and report.
- **Warning:** stylistic or non-critical. Engine must produce an index, reporting is optional.

Every diagnostic carries a stable error code. Tools rely on codes; messages are informational.

## Rationale and alternatives

**Why three levels and not two?**

Considered: errors + warnings. Rejected — collapses "broken" and "inconsistent" into one bucket, forcing engines to choose whether unresolved refs block the build (too strict for authoring) or pass silently (too loose for production).

**Why stable error codes?**

Tools like editors, CI bots, and migration scripts need to match on specific error types. Matching on prose breaks every time someone improves a message.

## Drawbacks

Authors now have three categories to learn. Mitigated by the categories mapping to natural intuitions: "broken," "inconsistent," "noticed."

## Open questions

Whether warnings should ever be promotable to errors via configuration. Deferred to engine implementations.

## Resolution

Shipped in 0.7.
