# Conformance Tests

Tiny sites, surgical. Each test pins down one rule.

## How conformance testing works

You can't test infinite edge cases in a spec. What you *can* test is whether an implementation handles the **defined** cases the same way every other implementation does. That's a conformance suite.

Each test in `conformance/NNN-name/` contains:

```
site/           # a complete (usually tiny) Mosaic site
expected.json   # what a conforming validator should report
```

To check a tool, run it against every `site/` and diff its output against `expected.json`. If everything matches, the tool conforms.

## What the suite covers

The suite is organized around the spec sections. Each rule in `SPEC.md` should have at least one passing and one failing test. The current suite covers:

| Section | Rule                                  | Tests              |
|---------|---------------------------------------|--------------------|
| §2      | Top-level layout                      | 001                |
| §3.1    | Record content (md/json/both)         | 002                |
| §3.2    | Direct vs folder shape                | 002, 023           |
| §3.3    | Title precedence                      | 019, 020           |
| §3.3    | Frontmatter forbidden                 | 021                |
| §3.4    | Slug rules                            | 003, 004           |
| §3.5    | Reserved/hidden names                 | 022                |
| §4.1    | Page routing                          | 001, 023           |
| §4.2    | Collection routing                    | 014, 015, 016      |
| §4.3    | Multiple mounts                       | 017                |
| §4.4    | Unrouted collections                  | 025                |
| §6.2    | `ref:` resolution                     | 007, 008, 024      |
| §6.3    | `asset:` resolution                   | 013                |
| §6.4    | Relative refs                         | 018                |
| §6.5    | Selectors                             | 010, 011, 012      |
| §6.7    | Circular refs                         | 009                |
| §7.1    | Structural errors                     | 004, 005, 006, 018, 021 |
| §7.2    | Drift                                 | 008, 012           |
| §7.3    | Warnings                              | 013                |

## Test format

`expected.json`:

```json
{
  "summary": { "structural": 0, "drift": 0, "warning": 0 },
  "diagnostics": [
    { "severity": "drift", "code": "mosaic.ref.unresolved", "source": "collections/team/anna.json" }
  ],
  "routes": [
    { "url": "/", "kind": "page" },
    { "url": "/team/anna", "kind": "record" }
  ]
}
```

A test passes if:

- The tool's diagnostic counts match `summary`
- Every diagnostic in `expected.json` appears in the tool's output (same code, same source)
- Every route in `expected.json` appears in the tool's output

Extra diagnostics or routes from the tool are tolerated unless the test explicitly says otherwise (set `"strict": true` in expected.json). This lets tools provide richer reporting without failing conformance.

## Running the suite

Implementations provide their own runner. A reference Node.js runner is in `runner/run.js`. To run:

```
node tests/runner/run.js --tool "mosaic validate --json"
```

The runner walks `conformance/`, runs the tool against each `site/`, diffs output against `expected.json`, and prints results.

## Adding a test

1. Pick the next number.
2. Make `NNN-short-name/site/` with the minimal site that triggers the rule.
3. Write `expected.json` with what should be reported.
4. Add a row to the table above.
5. Open a MIP if the test reveals an ambiguity in the spec.

## Property tests

A subset of rules are also tested with property-based tests in `property/`. These generate random inputs and check invariants:

- Slug regex: random strings either match or don't, no oracle disagreement
- Ref parser: round-trip parse → serialize → parse produces identical AST
- URL minting: any valid `pages/` path produces a valid URL string

Property tests catch implementation bugs that fixture tests miss because the input space is too large to enumerate.
