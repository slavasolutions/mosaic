# 033 — translatable field resolves against defaultLocale

A page has a translatable field on a section. The site declares
`site.defaultLocale: "en"` and `site.locales: ["en", "uk"]`. Without an active
locale request the validator resolves to the default-locale value. No
diagnostics.

Covers MIP-0014 §14.2 (translatable field shape) and §14.4 (resolution
algorithm).
