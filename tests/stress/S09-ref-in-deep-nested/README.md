# S09 — Ref in deeply nested JSON

## Setup

A ref buried five levels deep: `sections[0].wrapper.outer.rows[0].data.leader`.

## Spec

§5.7: "Engines MUST scan every string value in record JSON … regardless of depth."

## Expected

Both refs resolve. 0 diagnostics.

## Why this matters

Confirms the walker is truly recursive. Astro adapter, renderer, and validator all need to agree here or sites become non-portable.
