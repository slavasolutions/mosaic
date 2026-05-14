# Skill: session-start

Pick up work without losing the previous session's context.

## When to use

The first turn of any session that's resuming Mosaic work — whether minutes or weeks since the last one.

## Steps

1. **Read `V1.md`** — the destination. What's locked, what's deferred. Anchors every other decision in this session.

2. **Read the top of `CHANGELOG.md`** — last session's outcome. Tells you what the immediate state is.

3. **Read the memory index** at `/home/ms/.claude/projects/-home-ms-active-mosaic-spec/memory/MEMORY.md`. Open any file the index points at that looks relevant.

4. **Run the [`status`](./status.md) skill** — full snapshot.

5. **Scan in-flight MIPs.** Anything `draft` / `proposed` is unfinished work that may want continuing.

6. **Restate the goal** in chat to the user before touching files. One sentence: *"You want X; the repo is at Y; my plan is Z."* Wait for confirmation.

## Inputs needed

- A user prompt or session brief
- Repo access

## Output

- Shared understanding of the current state and the session's goal
- One sentence of confirmation from the user before file changes begin

## Pitfalls

- Don't assume the prior session's framing carries forward. Verify with the user — projects pivot between sessions.
- Memory can be stale. If a memory file's claim contradicts current repo state, trust the repo.
- Don't start editing before step 6. Burning files without alignment costs more than the alignment turn.
