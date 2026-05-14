# Mosaic skills

Reusable workflows for running this repo. Each skill is a short, actionable process doc — not policy, not spec content.

The **policy** lives in:
- `CONTRIBUTING.md` — versioning rule, commit/PR rules, dep-free principle
- `AGENTS.md` — the same for AI sessions

These **skills** tell you *how* to apply that policy in concrete situations.

## When to use a skill

Skills cover recurring, low-novelty work where consistency matters more than creativity. Use one when you find yourself thinking "I'm doing this again, the same way as last time."

Don't use a skill for spec work, MIP authoring (use `propose-mip` for the workflow, but the *content* of a MIP is novel), or anything that requires real judgment about Mosaic itself. Skills are for the operational layer above the format.

## Skill index

| Skill | When |
|---|---|
| [`release.md`](./release.md) | End of a session that shipped output |
| [`status.md`](./status.md) | Onboarding, mid-session check-in, or handoff |
| [`session-start.md`](./session-start.md) | Picking up work from a previous session |
| [`session-end.md`](./session-end.md) | Closing a session cleanly |
| [`propose-mip.md`](./propose-mip.md) | Authoring a new MIP |

## Adding a skill

Drop a `<name>.md` file in this directory with this shape:

```markdown
# Skill: <name>

<one-line summary>

## When to use
<the trigger condition>

## Steps
<numbered list, terse>

## Inputs needed
<what you must have on hand>

## Output
<what exists after running this skill>

## Pitfalls
<common ways to get this wrong>
```

Add a row to the table above. No MIP needed; skills are repo-internal process docs that can evolve freely.
