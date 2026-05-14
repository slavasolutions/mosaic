# 010 - selector resolving into JSON

`ref:site@contact.email` resolves the `site` singleton, then dot-paths into `contact.email`.
The singleton record is `site.json` at the site root (per SPEC §1.4). No diagnostics expected.
Spec §5.6.
