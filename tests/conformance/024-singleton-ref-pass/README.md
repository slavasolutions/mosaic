# 024 - singleton ref resolves cleanly

`mosaic.json` declares a `site` singleton bound to `SiteConfig`. The record lives at the
site root as `site.json` (per SPEC §1.4). A page references it via `ref:site@contact.email`,
which resolves to `"hi@example.com"`. No diagnostics. Spec §5.3 (singleton address form)
and §5.6 (JSON selector).
