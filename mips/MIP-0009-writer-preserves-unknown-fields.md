# MIP-0009: Writers preserve unknown fields

- **Status:** shipped (0.8)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.8

## Summary

Any tool that writes a Mosaic file MUST preserve unknown fields verbatim. This applies to `mosaic.json`, every record's JSON, `images/manifest.json`, and custom page sections.

## Motivation

Mosaic content is meant to round-trip between engines. Engine A might add `clearcms.canonicalHash` to a record; engine B reads the record, edits the title, writes it back. If B silently strips fields it doesn't recognise, A's hash is lost and the round-trip becomes destructive.

The rule existed implicitly in 0.6 (as part of the Level 2 conformance definition) and was lost in the 0.7 simplification. 0.8 restores it as a first-class requirement — load-bearing for forward compatibility.

## Specification

See SPEC §6.6.

For each of the following file kinds, a tool that writes the file MUST preserve any fields it did not author:

- `mosaic.json` — unknown top-level keys; unknown keys inside each `type`, `collection`, `singleton`; unknown fields inside redirect rules; unknown fields inside the tokens payload.
- Record JSON (pages, collection records, singletons) — unknown fields at any nesting level.
- `images/manifest.json` — unknown fields per asset entry.
- Custom page sections — preserved as opaque objects.

Engines MAY add fields anywhere as long as the field name is prefixed with their identifier (`clearcms.*`, `astro.*`, etc.) or follows the `$prefix` convention used by JSON Schema (`$mosaic.something`). Unprefixed unknown fields are author content and MUST be preserved.

## Rationale and alternatives

**Option: writers strip unknowns by default.** Rejected — every round-trip loses data; engines diverge.

**Option: writers preserve at top level only.** Rejected — the most useful engine-specific data is per-record (per-section render hints, per-asset transforms, per-collection sort overrides). Top-level-only preservation is the wrong layer.

**Option: writers preserve only fields with a reserved prefix.** Rejected — authors add their own fields too; treating unprefixed unknowns as deletable is a footgun.

## Drawbacks

Round-trip determinism becomes harder. A writer that preserves field A in record X must also remember A's *position* in the JSON object if it cares about diff-friendliness. Most writers can sort fields alphabetically and accept the diff cost; serious diff-conscious tools serialize via a canonical key order.

## Resolution

Shipped in 0.8.
