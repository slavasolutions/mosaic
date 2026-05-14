# MIP-0012: Redirects

- **Status:** shipped (0.8)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.8

## Summary

Redirects are first-class. Declared either inline in `mosaic.json#redirects` or via a `redirects` singleton at the root. Each rule maps an old URL to a new URL with an optional HTTP status code. Engines MUST report redirect loops and source/target collisions as structural errors.

The `/home → /` redirect is emitted automatically by every engine (see MIP-0013).

## Motivation

Every long-lived site accumulates URL changes — content moves, slugs evolve, sections get reorganized. Without first-class redirects, authors are forced to either keep old pages alive forever (cruft) or break inbound links (bad). Engines that support redirects each invent their own location, which makes content non-portable across engines.

Redirects were deferred in 0.7 §11 as "may be addressed in a future MIP." This is that MIP.

## Specification

See SPEC §3.6.

A redirect rule:

```json
{ "from": "/old-news", "to": "/news", "status": 301 }
```

- `from` (required) — old URL path. MUST start with `/`.
- `to` (required) — new URL path or absolute URL.
- `status` (optional) — HTTP status code (301, 302, 307, 308). Default `301`.

Two declaration locations:

1. **Inline** in `mosaic.json#redirects` as an array.
2. **Singleton** at the root — a `redirects.json` file with `{ "rules": [ ... ] }`.

If both exist, the singleton wins; engines SHOULD emit `mosaic.redirect.duplicate-source` (warning).

Validator behavior:

- Detect loops (`A → B → A`, or any cycle) → `mosaic.redirect.loop` (structural).
- Detect `from` colliding with an actual page or record route → `mosaic.redirect.collision` (structural).
- Detect rules with the same `from` → keep the first, emit `mosaic.redirect.duplicate-from` (warning).

Engine behavior:

- Native engines respond with the configured HTTP status and `Location` header.
- Embedded engines surface the redirect table to the host framework's routing layer.
- Wireframe renderers MAY emit static `<meta http-equiv="refresh">` placeholders.

## Rationale and alternatives

**Option: declare redirects per-page in page JSON.** Rejected — redirects are site-level routing concerns; scattering them across page files makes them invisible to authors trying to understand the URL map.

**Option: HTML files at the redirect path.** Rejected — works in static hosting but not in dynamic engines, and bloats the folder.

**Option: only support 301.** Rejected — 307/308 matter for non-GET requests; 302 matters for temporary moves. Cost of supporting four is one validator enum.

**Option: defer to engine-specific config files (`_redirects`, `netlify.toml`, etc.).** Rejected — non-portable.

## Drawbacks

Adds a route-table entry kind beyond `page` and `record`. Validators must walk redirects in addition to mounts. Cost is small.

Redirect loops are hard to author by accident but easy to introduce via mass-edits or migration tools. The structural-level severity is deliberate: a loop will hang server-side request handling, so refusing to build is the right default.

## Resolution

Shipped in 0.8.
