# Tools

Reference contracts for the v1 tool list. Each subdirectory describes one tool's CLI surface, inputs, outputs, and exit codes. Implementations live elsewhere — this directory is normative for *behavior*, not code.

## Tools

| Tool       | Purpose                                                       | Used                  |
|------------|---------------------------------------------------------------|-----------------------|
| `validate` | Check structure, schema conformance, ref integrity            | Every build, every CI |
| `index`    | Produce a derived index (JSON or SQLite)                      | Build time            |
| `init`     | Scaffold a fresh Mosaic site from a manifest                  | Once per project      |
| `infer`    | Generate a draft `mosaic.json` from existing content          | During migration      |
| `migrate`  | Convert a non-Mosaic folder into Mosaic shape                 | Once per legacy site  |
| `fix`      | Apply mechanical drift repairs                                | After schema changes  |
| `render`   | Emit a basic HTML wireframe site from a Mosaic folder         | Proofing, theming     |

A reference implementation of `validate` lives under `validate/impl/`. Other tools have their own `impl/` directories as they land.

## Conformance

A tool is conforming to its contract if its observable behavior — exit codes, output format, file mutations — matches the contract document. Implementations may add features beyond the contract but must not change documented behavior.

## Shared conventions

All tools:

- Read the site root from the current working directory or from `--site <path>`.
- Emit human-readable output on stdout by default and machine-readable JSON with `--json`.
- Exit `0` on success, `1` on structural errors, `2` on drift (only when `--strict`), `64+` on invocation errors (per BSD sysexits).
- Accept `--quiet` and `--verbose`. Default is human-friendly.

Any tool that mutates files must support `--dry-run` and print what it would do.
