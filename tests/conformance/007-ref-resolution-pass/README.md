# 007 - ref resolution pass

A page section contains `ref:team/alice`. The record exists at
`collections/team/alice.json`, so the ref resolves cleanly to a stub. No diagnostics.
The collection has no mounting page, so records remain unrouted (`url: null` in stub),
but resolution itself succeeds. Spec §5.3.

Note: a `mosaic.collection.unmounted` warning is allowable (extras are tolerated unless
strict). Counts here pin only the must-be-absent cases.
