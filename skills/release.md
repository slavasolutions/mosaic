# Skill: release

Ship a version per the session-equals-step rule (`CONTRIBUTING.md`).

## When to use

End of any work session that produced shipped output. One file change or a hundred — if the work lands on a branch the user accepts, bump the version.

## Steps

1. **Pick the bump.**
   - **Patch** (`x.y.Z`) — docs, typos, tooling fixes, internal refactor. No spec semantic change.
   - **Minor** (`x.Y.z`) — shipped MIP, new feature, new tool. Pre-1.0 minor may break.
   - **Major** (`X.y.z`) — only post-1.0. Semver semantics apply.

2. **Write the CHANGELOG entry.** Append at the top of `CHANGELOG.md`:

   ```markdown
   ## <version> — <title> (<YYYY-MM-DD>)

   - <bullet describing the outcome>
   - <bullet linking any MIPs touched: see MIP-NNNN>
   ```

   Maximum 8 bullets. Terse, outcome-focused. Voice matches existing entries.

3. **Update version references** in any file that pins the spec version:
   - `Version:` line at the top of `SPEC.md`
   - `mosaic_version` in any example index files
   - `version` field in `package.json` files under `tools/` / `packages/`

4. **Commit.** Atomic commits per logical chunk are fine; the final commit's subject includes the version: `release: <version> — <title>`.

5. **Tag.** `git tag -a v<version> -m "<title>"` for notable releases; plain `git tag v<version>` for patches.

6. **Push branch + tag.** `git push origin <branch> --tags`.

7. **Open the PR.** Title: `Release <version> — <title>`. Body: links the CHANGELOG entry and the MIPs touched.

## Inputs needed

- Working tree clean except for the CHANGELOG + version bumps
- Knowledge of what the session shipped
- Optional: numbers of any MIPs touched

## Output

- One CHANGELOG entry
- One annotated git tag
- One open PR

## Pitfalls

- Pre-1.0 doesn't justify breaking things gratuitously. Only break when the cost is earned.
- Don't merge your own PR; the repo owner reviews and merges. Branch protection should enforce.
- Don't skip the CHANGELOG entry. Commit messages alone do not satisfy the rule.
- If multiple sessions ship in the same calendar day, each still gets its own version bump and CHANGELOG entry.
