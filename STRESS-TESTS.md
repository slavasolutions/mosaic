# Stress tests for the Mosaic spec

Adversarial test cases that probe the v0.5 format spec at its edges. The goal is **not** to find bugs in implementations — it's to find places where the spec is silent, contradictory, or surprising. Cases that surface real ambiguity become MIP-discussion candidates upstream.

Stress testing here is **discovery**, not regression. We're trying to refine the spec, not enforce it.

## Bucket model

Each case lives under `tests/` in one of three buckets:

| Bucket | What it means | What "passing" looks like |
| --- | --- | --- |
| `valid/` | Sites that MUST validate cleanly against `mosaic.schema.json` AND spec-text validation (§6) | Validator returns no errors |
| `invalid/` | Sites that MUST fail validation. The expected failure mode is documented per case. | Validator returns the documented error category |
| `edge-cases/` | Sites where the spec is silent or contradictory. No "right" answer in v0.5. | Documented in the case README; each is a candidate for a MIP-discussion issue |

The third bucket is where the value lives. Every edge case that surfaces real ambiguity becomes an input to refining the spec.

## How a case is structured

```
tests/<bucket>/<case-name>/
├── mosaic.json       the test artifact (REQUIRED)
├── content/          supporting content tree (OPTIONAL — many cases don't need this)
└── README.md         what this case probes; expected outcome; MIP link (for edge-cases)
```

The case README is the discussion record. For edge-cases, it should:

1. State the scenario in one sentence.
2. Quote the spec text that's silent or ambiguous.
3. Propose the candidate behavior (or list multiple).
4. Link to the MIP-discussion issue, if filed.

## Case index

| Bucket | Case | What it probes | MIP status |
| --- | --- | --- | --- |
| `valid` | `zero-content` | §3.1 minimal valid document | n/a |
| `invalid` | `list-impossible-bounds` | `list.min > list.max` is internally inconsistent but spec-text doesn't explicitly forbid | MIP candidate |
| `invalid` | `locales-missing-default` | `i18n.locales` doesn't include `defaultLocale` (§4.8 says it MUST, schema doesn't enforce) | MIP candidate |
| `edge-cases` | `circular-refs` | §7.5 cycle detection — but which side wins, and what about N-cycles? | Open |
| `edge-cases` | `token-cascade-partial-shadow` | §4.2a override map mixing valid + invalid names — clear in rules, no worked example | Spec PR candidate |

## Future cases worth adding

A starter list of scenarios not yet built. PR contributions welcome.

- `valid/single-locale-site` — `i18n.locales: ["en"]` with no fallback edge cases
- `valid/struct-with-all-optional-fields-absent` — confirms `{}` is not "empty" for struct type
- `invalid/richtext-string-with-portable-format-declared` — §4.5.1 contradiction
- `invalid/blockType-not-declared-but-referenced` — section referencing undeclared blockType (handled by §6 not schema; **can't be caught by `mosaic.schema.json` alone** — this is exactly why spec-text validation is required after schema fast-path)
- `invalid/list-min-exceeds-actual-length` — runtime list-length check (also not schema-encodable)
- `edge-cases/sectionInstance-id-with-only-numbers` — does `"id": "42"` violate the "stable across edits" rule?
- `edge-cases/asset-ref-resolves-to-binary-but-format-implies-text` — `.png` file at a path the spec doesn't restrict
- `edge-cases/i18n-fallback-with-locale-not-in-locales` — request for `de` when `locales: ["en", "fr"]`. §4.8 says "missing locale" but doesn't define "missing"
- `edge-cases/draft-section-affects-globals-numbering` — does `state: "draft"` shift `before-section:<n>` indices for OTHER sections? §5.1.1 says "excluded from rendered output" but doesn't address index counting (globals were removed in v0.5, but the principle applies if they're re-added)
- `edge-cases/translatable-slot-empty-all-locales` — value is `{en: "", fr: ""}`. §4.8 says "if neither has a value, treat as empty." But is empty string a "value" here? §6.2 says richtext empty string IS empty. Consistent?
- `edge-cases/asset-content-md-vs-asset-with-md-suffix` — Appendix C says these are syntactically the same but behaviorally different. What's the contract when the asset is `.md` but the slot is declared `asset` not `richtext`?

## Process

Adding a case is a direct PR — no MIP needed (a test is documentation). If a case surfaces a genuine spec ambiguity, ALSO file a MIP-discussion issue per [`CONTRIBUTING.md`](CONTRIBUTING.md). The case README should link to the issue.

This catalog is not exhaustive and will grow. Every edge-case that gets resolved by a MIP should be marked accordingly in this file (or moved to `valid/` / `invalid/` if the resolution makes the answer deterministic).
