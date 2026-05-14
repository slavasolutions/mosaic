# 017 — multiple mounts of the same collection

`pages/index.json` and `pages/news.json` both mount `collections/news`. The homepage shows
the 3 latest records but sets `"routes": false` (it doesn't claim detail URLs). `/news`
mounts with routing on, so `/news/launch` is minted by `/news`.

This is permitted per SPEC §4.2 and §4.3.
