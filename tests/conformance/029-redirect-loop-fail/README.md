# 029 - redirect loop fails

`mosaic.json#redirects` declares `/a → /b` and `/b → /a`. Per §3.6, engines MUST detect
redirect loops and emit structural `mosaic.redirect.loop`.
