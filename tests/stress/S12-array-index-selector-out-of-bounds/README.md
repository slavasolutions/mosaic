# S12 — Array index selector out of bounds

## Setup

`ref:header@nav.99.label` — index 99, but `nav` only has 3 items.

## Expected

`mosaic.selector.unresolved` (drift). The selector points at no real value.
