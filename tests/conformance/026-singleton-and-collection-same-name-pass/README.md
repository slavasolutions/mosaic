# 026 - singleton and collection share a name

A singleton named `team` and a collection named `team` coexist (SPEC §5.3 explicitly
permits this). `ref:team` (no `/`) resolves to the singleton at the site root.
`ref:team/anna` (split on first `/`) resolves to the collection record. Both resolve
cleanly. No diagnostics.
