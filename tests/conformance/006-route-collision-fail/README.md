# 006 — route collision

`pages/about.md` and `pages/about/index.md` both route to `/about`. Validator must emit
`mosaic.route.collision` as structural and refuse to produce an index.
