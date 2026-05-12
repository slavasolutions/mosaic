# tests/

Adversarial test cases for the Mosaic format spec. See [`../STRESS-TESTS.md`](../STRESS-TESTS.md) for the full catalog + rationale.

## Layout

```
tests/
├── valid/        sites that MUST validate
├── invalid/      sites that MUST fail validation (expected error category in case README)
└── edge-cases/   sites where the spec is silent; each is a MIP-discussion candidate
```

## Running a case

There's no official runner yet. To validate a case manually:

1. **JSON Schema fast-path** — validate the case's `mosaic.json` against `../mosaic.schema.json` using any JSON Schema 2020-12 validator (e.g. Python's `jsonschema`, JS's `ajv`).
2. **Spec-text validation** per §6 of `../spec.md` — applies all cross-reference rules the static schema can't encode.

A case in `valid/` must pass both. A case in `invalid/` must fail at least one (with the documented error). A case in `edge-cases/` is **documented**; "passing" or "failing" is implementation-defined until the spec resolves it.

## Adding a case

See [`../STRESS-TESTS.md#how-a-case-is-structured`](../STRESS-TESTS.md). New cases land as direct PRs (no MIP needed — adding a test is documentation). If a case surfaces a genuine spec ambiguity, ALSO file a MIP-discussion issue per [`../CONTRIBUTING.md`](../CONTRIBUTING.md). The case README should link to the issue.
