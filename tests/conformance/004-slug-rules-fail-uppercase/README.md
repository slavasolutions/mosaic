# 004 — slug rules: uppercase fails

Per SPEC §3.4, slugs must match `^[a-z0-9][a-z0-9-]*$`. Uppercase letters are forbidden.
A conforming validator must emit `mosaic.slug.invalid` as a structural error and refuse to produce an index.
