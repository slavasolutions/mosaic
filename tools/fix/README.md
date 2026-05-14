# `mosaic fix`

Applies mechanical drift repairs to a site. Reads `mosaic validate` output and edits files where the fix is unambiguous. Refuses to act where it isn't.

## Usage

```
mosaic fix [--site <path>] [--dry-run] [--codes <comma-separated>]
```

## Behavior

1. Runs validation in-process.
2. For each drift diagnostic with a known auto-fix, computes the edit.
3. Without `--dry-run`: applies edits and reports what changed.
4. With `--dry-run`: prints the edits without applying.
5. Re-runs validation at the end. Reports remaining drift.

## Auto-fixable diagnostics

| Code                          | Auto-fix                                            |
|-------------------------------|-----------------------------------------------------|
| `mosaic.field.required` (with default) | Insert the default value into each record missing the field. |
| `mosaic.field.unknown`        | Move the field under `$mosaic.legacy` so it's preserved but stops triggering. (Manual cleanup needed.) The `$mosaic.*` prefix is the conventional tool-authored namespace per MIP-0009. |
| `mosaic.title.dead-h1`        | Remove the H1 from markdown when JSON also has `title`. |
| `mosaic.slug.case`            | Rename file/folder to lowercase. Update incoming refs. |
| `mosaic.ref.unresolved`       | If the target's slug changed via case-fix and the new slug is unambiguous, update the ref. Otherwise refuse. |
| `mosaic.frontmatter.present`  | Extract the YAML/TOML frontmatter block into a JSON sidecar (`<slug>.json`) and rewrite the markdown without the block. If a sidecar already exists, refuses and asks for manual review. |
| `mosaic.home.reserved`        | If no `pages/index.{md,json}` exists, rename `pages/home.{md,json}` (or folder `pages/home/`) to `pages/index.*`. If an index already exists, move the home file to `pages/_home-deprecated.*` so it stops triggering the rule while preserving the content for manual review. |

Nothing else in SPEC §6 is auto-fixable; everything below requires human judgment.

## Not auto-fixable

- Missing required fields with no default.
- Refs to genuinely deleted targets.
- Type mismatches.
- Anything ambiguous.

## Safety

`fix` never deletes content. Maximum it does is rename, move fields, or insert defaults. Use version control. `--dry-run` is the safe default for first-time use.

## Example

```
$ mosaic fix --site ./my-site --dry-run

Would fix:
  collections/team/Anna-K.json
    rename → collections/team/anna-k.json   (mosaic.slug.case)
  collections/news/launch.json
    remove H1 from launch.md                (mosaic.title.dead-h1)

Cannot fix (manual review needed):
  pages/contact.json
    ref:footer@phone — selector unresolved (no auto-fix)

Run without --dry-run to apply 2 fixes.
```
