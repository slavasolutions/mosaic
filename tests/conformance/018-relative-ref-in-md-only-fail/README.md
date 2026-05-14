# 018 - relative ref in markdown-only record (STUB)

SPEC §5.5 says: "A relative ref in a markdown-only record has no defined 'here' - engines
MUST report it as `mosaic.relative.invalid` (structural)."

But SPEC §5.7 says refs are detected only by scanning string values inside record **JSON**:
"engines MUST scan every string value in record JSON and treat the value as a ref if it
begins with `ref:`, `asset:`, or `./`". Markdown body text is not a ref carrier.

So the only way to produce this diagnostic is for a sidecar pair (md + json) to be split
unevenly - e.g. a folder-shape that contains JSON with a relative ref, then later the
JSON is removed leaving only markdown. The "markdown-only record with relative ref" case
described in §5.5 has no test-able artifact under the §5.7 detection rule.

Leaving as `_stub: true` until SPEC §5.5 / §5.7 reconciliation. **Spec ambiguity to surface
to the spec author.**
