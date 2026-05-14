# S04 — Deep collection-list

## Setup

Page at `pages/archive/2024/winter.json` mounts `collections/notes` with default urlPattern.

Expected routes:
- `/`
- `/archive/2024/winter` (the page itself)
- `/archive/2024/winter/alpha`
- `/archive/2024/winter/beta`
- `/home` (auto-redirect)

## Question

Does the default urlPattern `<page-url>/{slug}` compose correctly when the page URL is deep? It should — `<page-url>` is just the page's full URL, which the engine already computed.

## Spec

§3.3 default pattern is `<page-url>/{slug}`. No depth limit. Should work.
