# 025 - unrouted collection produces warning

`collections/orphans/alpha.json` exists, but no page mounts the collection and no other
record references it. Records remain addressable by ref but have no URL (§3.7). A
warning `mosaic.collection.unmounted` is emitted (§6.4). Routes MUST NOT include
`/orphans/alpha`.
