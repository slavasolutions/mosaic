# S05 — Conflicting urlPatterns for the same collection

## Setup

Two pages, both `routes: true` (default), both mount `collections/notes` but with different patterns:
- `/posts/{slug}` (default from page URL `/posts`)
- `/journal/{slug}` (explicit override on `/journal`)

The record `alpha` ends up routed at TWO URLs: `/posts/alpha` AND `/journal/alpha`.

## Spec

§3.5: "Different URLs for the same record → route collision (structural)."

## Question

Where is the diagnostic sourced? Two readings:
- At the record: `collections/notes/alpha` (the thing with two URLs).
- At one of the mounts: `pages/posts.json` or `pages/journal.json` (the conflict cause).
- At both mounts.

The validator currently sources at the record path. Spec is silent.

## Recommendation

Spec should say: source is the record path, with the message naming both URLs and both mounting pages. This is the most useful diagnostic for the author: "fix the record's routing."

**MIP candidate:** Spec clarification, no MIP needed if §3.5 picks up a sentence.
