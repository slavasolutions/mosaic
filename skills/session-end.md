# Skill: session-end

Close a session so the next one can resume without confusion.

## When to use

When the session's planned work is done, or when the user signals stopping.

## Steps

1. **Run the [`release`](./release.md) skill** if anything shipped.

2. **Update memory.** If decisions were made that bind future sessions, write or update files in `/home/ms/.claude/projects/-home-ms-active-mosaic-spec/memory/`:
   - Add a new `project_<topic>.md` if a new initiative crystallised
   - Update the `MEMORY.md` index if you added a file
   - Don't duplicate code state that `git log` already captures
   - Capture only decisions that are non-obvious from reading the repo

3. **Note open questions.** Anything left unanswered goes into:
   - The relevant MIP (if it's a spec question)
   - A new MIP draft (if it doesn't fit an existing one)
   - A memory file (if it's process or scope, not spec)
   - **Never** leave open questions only in conversation history.

4. **Run `git status`.** Confirm nothing is uncommitted unless intentionally. If something is stashed, mention it.

5. **Tell the user what shipped** in one sentence, including the version bumped to.

## Inputs needed

- Knowledge of what got done this session
- The version bump from `release`

## Output

- All work either committed, stashed with a note, or explicitly discarded
- CHANGELOG entry in place
- Memory updated for any cross-session decisions
- One-line summary to the user

## Pitfalls

- Don't end with uncommitted work and no plan for it. Commit or stash, but state which.
- Don't leave the branch in a half-state — e.g., partial MIP draft uncommitted with no note about why.
- Don't write a memory file that just paraphrases the CHANGELOG. Memory captures decisions and context; the CHANGELOG captures shipped outcomes.
