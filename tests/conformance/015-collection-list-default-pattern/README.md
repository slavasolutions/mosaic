# 015 - collection-list default URL pattern

`pages/news.json` mounts `collections/news` with no `urlPattern`. The default
`<page-url>/{slug}` produces `/news/foo` and `/news/bar` (§3.3). No diagnostics.
