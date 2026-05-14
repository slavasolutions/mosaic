# 032 - tokens singleton + ref

`tokens.json` is a DTCG-shaped singleton bound to type `DesignTokens` (§10). A page
references `ref:tokens@color.accent`, which resolves via the JSON-path selector to
`"#0066cc"`. No diagnostics.
