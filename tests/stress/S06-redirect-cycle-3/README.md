# S06 — Three-node redirect cycle

## Setup

`/a → /b → /c → /a`. Tightest possible cycle that isn't a 2-cycle.

## Spec

§3.6: "Detect redirect loops … and report as structural (`mosaic.redirect.loop`)."

## Expected

ONE `mosaic.redirect.loop` diagnostic (not three). Validator's `findCycle` walks the chain, detects the cycle, marks all nodes seen, and skips further emissions for that cycle.

This was a bug in the first validator pass (emitted one per node); fixed already.

## Spec gap

§3.6 says "redirect loop" but doesn't say "one diagnostic per cycle, not per node in cycle." Worth a clarifying sentence.
