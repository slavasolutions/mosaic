# 030 - redirect collides with real route

A redirect declares `from: /about`, but `pages/about.md` already mints `/about`. Per
§3.6, engines MUST emit structural `mosaic.redirect.collision`.
