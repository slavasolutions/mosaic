# Test runner

A minimal Node.js script that runs the conformance suite against any tool that conforms to the `validate --json` contract.

## What it does

1. Walks `tests/conformance/`.
2. For each test directory containing both `site/` and `expected.json`:
   - Runs the tool against `site/`.
   - Parses the tool's JSON output.
   - Compares against `expected.json`.
3. Prints pass/fail per test, totals at the end.
4. Exits `0` if all pass, `1` otherwise.

## Comparison rules

- **Diagnostic counts** in `summary` must match exactly.
- **Each diagnostic** in expected.json must appear in tool output (matching by `code` and `source`).
- **Each route** in expected.json must appear in tool output (matching by `url`).
- Tool may emit extra diagnostics/routes; this is tolerated unless `"strict": true` is set in expected.json.
- Tests where `expected.json` contains `"_stub": true` are skipped with a stub-skip notice.

## Usage

```
node tests/runner/run.js --tool "mosaic validate --json"
```

The `--tool` value is the shell command to run. The runner appends `--site <path>` automatically.

## Implementation

See `run.js`. The script is intentionally tiny (~80 lines) and dependency-free.
