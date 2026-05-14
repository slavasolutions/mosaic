# 034 — locale-suffix record

A news record exists as `launch.md` (default-locale body) and `launch.uk.md`
(per-locale body) in the same collection. The site declares
`site.locales: ["en", "uk"]`. Both files belong to the same logical record
`launch`; the validator treats the `.uk` suffix as a locale variant rather
than as part of the slug.

No diagnostics expected: both files have valid base-stem slugs after the
suffix strip, no frontmatter, and the locale tag is in `site.locales`.

Covers MIP-0014 §14.3 (locale-suffix records) and SPEC §2.5 grammar amendment.
