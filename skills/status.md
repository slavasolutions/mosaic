# Skill: status

Inventory the current state of the repo for a check-in, handoff, or onboarding moment.

## When to use

- Start of a session, when picking up cold
- Mid-session if context is muddy or the previous frame doesn't hold
- End of session, to produce a handoff snapshot

## Steps

1. **Git state.**
   ```
   git branch --show-current
   git log --oneline -10
   git status --short
   git worktree list
   ```

2. **Current spec version.** Read top of `SPEC.md` (`Version: x.y` line).

3. **Top CHANGELOG entry.** Read first `##` block of `CHANGELOG.md`. That's the most recent shipped session.

4. **In-flight MIPs.** `grep -E '^- \*\*Status:\*\*' mips/MIP-*.md`. Anything `draft` or `proposed` is unfinished.

5. **V1 progress.** Open `V1.md`. Mentally check each item against the current repo — what's done, what's open, what's blocked.

6. **Conformance.** If validator and corpus are in place:
   ```
   node tools/validate/impl/validate.js --site examples/minimal-site --human
   node tests/runner/run.js --tool "node tools/validate/impl/validate.js"
   ```
   Note the pass/fail count.

7. **Memory pointers.** Check `/home/ms/.claude/projects/-home-ms-active-mosaic-spec/memory/MEMORY.md` for cross-session notes.

## Inputs needed

- Read access to the repo
- Optional: Node installed for conformance step

## Output

A short report:

```
Branch: <name> at <commit>
Spec version: <x.y>
Last shipped: <CHANGELOG top entry title>
MIPs proposed: <N>, accepted but unshipped: <M>
V1: <X> / <Y> items complete
Conformance: <P> / <T> passing
Open notes: <key memory items>
```

## Pitfalls

- Don't trust `BUILD_REPORT.md`-style handoff docs from prior sessions; they go stale fast. Trust `CHANGELOG.md`, `git log`, and the spec/MIP files themselves.
- The memory dir is a hint, not gospel. Verify any factual claim against the current files before relying on it.
