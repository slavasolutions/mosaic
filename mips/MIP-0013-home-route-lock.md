# MIP-0013: Home is `/`

- **Status:** shipped (0.8)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.8

## Summary

The home route is always `/`. `pages/index.{md,json}` mints it. The slug `home` at the top level of `pages/` is reserved — a file or folder named `pages/home.*` is a structural error. Every engine automatically emits a redirect from `/home` to `/` so the spelling is never ambiguous to visitors or authors.

## Motivation

A surprisingly common authoring error: a site has both `pages/index.md` (the conventional home) and `pages/home.md` (added later because someone thought it would be more obvious). Navigation links to `/home`, but search engines and inbound links point to `/`. Result: the home page exists in two places, with two copies of content that drift apart over time.

The cost of preventing this is one reserved slug and one auto-redirect. The benefit is the home URL never has two spellings.

## Specification

See SPEC §3.2 and §3.6.

- `pages/index.{md,json}` mints `/`.
- `pages/home.md`, `pages/home.json`, or `pages/home/` (a folder) MUST be reported as `mosaic.home.reserved` (structural).
- Every engine MUST emit an automatic redirect entry with `from: "/home"`, `to: "/"`, `status: 301`, `source: "auto"` in the index `redirects` array.
- Authors MAY override the auto-redirect by declaring their own redirect from `/home` in `mosaic.json#redirects` or the `redirects` singleton. Explicit declarations win over the auto-entry.

Subdirectories `pages/<something>/home.*` (e.g. `pages/services/home.md`) are NOT reserved. The lock applies only to the top-level `pages/home.*`.

## Rationale and alternatives

**Option: do nothing.** Rejected — the dual-spelling problem is real and common.

**Option: warn instead of structural error.** Rejected — warnings get ignored. The point of the rule is to prevent the situation, not just notice it.

**Option: allow `pages/home.*` and treat it as an alias for `pages/index.*`.** Rejected — two files for the same route is confusing storage; the auto-redirect handles the navigation case without filesystem duplication.

**Option: reserve `home` at every directory level.** Rejected — `pages/services/home.md` is a perfectly reasonable section landing page. Over-reserving.

## Drawbacks

Authors migrating from systems where `/home` is canonical (rare but it exists, e.g. some old PHP CMSes) will hit the structural error during migration. Mitigation: `mosaic migrate` renames `home.*` to `index.*` automatically.

Tooling must remember to emit the auto-redirect even when no redirects are otherwise declared. Cost is one array entry.

## Resolution

Shipped in 0.8.
