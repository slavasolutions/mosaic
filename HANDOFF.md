# Mosaic 0.9 — Session Handoff

> Read this first. Points at everything else. Skim this in 2 minutes.

## What this project is, in 5 sentences

1. **Mosaic** is an open spec for storing web content in a folder — files are records, folders are collections, refs link them via cascade lookup; the format is portable, vendor-neutral, and AI-editable because it's just text files.
2. **The filesystem is the database** — atomic writes, concurrent reads, OS-level permissions, change watching, and (with git) multi-user version control come free; no custom DB engine needed for ~80% of workflows.
3. **FolderDB** is the open-source editor/viewer — profile-agnostic; reads any Mosaic content; bundles a whole site as a single self-contained `.mosaic.html` file you can email or open in any browser.
4. **Clear** is the commercial CMS product on top — closed-source admin, hosted multi-user editing with real-time collaboration, but content stays in portable Mosaic format so users can leave anytime.
5. **Three layers**: spec at the bottom (free, open), tools in the middle (free, open), product on top (paid, closed) — open format prevents lock-in; paid product earns money on what filesystem + git can't do alone.

## State of the world right now

| | |
|---|---|
| Spec version | 0.9 (draft) |
| Branch | `0.9-realignment` — 16+ commits |
| License live on main | PR #2 (CC0 → CC BY 4.0 + Apache 2.0) — awaiting merge |
| Trademark | "Mosaic" + "MIP" — Slava Solutions |
| Production consumers | Zero. Break freely. |
| Worktree | `/home/ms/active/mosaic-spec/mosaic-spec/.claude/worktrees/v0.9/` |

## The three things to read (in order)

1. **`STATE.md`** — the comprehensive working overview. 640 lines, every decision documented, every open question. Canonical.
2. **`PRINCIPLES.md`** — the 3 foundational claims. Read in 1 minute.
3. **`VIEWER.html`** — open in browser. Interactive folder viewer with Mosaic / STAC / OCI tabs. Shows all the cases discussed visually.

## What's locked (top 15)

1. Mosaic = format; FolderDB = editor app; Clear = commercial CMS product
2. 3 principles: folder is website / refs link records / forward-safe
3. JSON-only structural index; markdown is referenced content
4. Cascade walks parent chain (no special carveouts)
5. Sidecar override = cascade applied to globals (same mechanism)
6. One `ref:` grammar with three anchors (cascade / `/` / `./`) + `@` selector restored
7. Unified `x-` namespace marker (fields + sidecars)
8. Drop "singleton/global" term; root files are just records
9. Drop `collections/` parent; collections directly at root
10. Frontmatter is HARD BAN (not silent)
11. Two-phase locale resolution: locale first, cascade second
12. `.mosaic` = zip with renamed extension (EPUB-style)
13. JSON Schema for record field types (instead of bespoke shape)
14. Optional `@type` field on types for schema.org alignment (no profile concept)
15. Core stays in spec repo (one repo, monorepo until 1.0)

## Open / deferred (top 5)

1. **Ref identity & rename safety** — CRITICAL blind spot. Need MIP-0016 with optional `$id` per record. Path-based default; identity-based escape hatch.
2. **Layered spec split** — FolderDB substrate + Mosaic CMS profile. Architectural opportunity; defer to 0.10+.
3. **SPEC.md rewrite** — currently 0.8.1; needs full rewrite for 0.9 decisions. Defer to 0.10.
4. **FolderDB editor app** — formerly `mosaic-explorer`. Build 0.11+.
5. **Clear monetization** — closed admin + open format. Post-1.0.

## Files & where they live

| File | Purpose |
|---|---|
| `PRINCIPLES.md` | 3 foundational claims |
| `SPEC.md` | Normative rules (0.8.1 content; needs 0.10 rewrite) |
| `CHANGELOG.md` | Reconstructed back to 0.0 with placeholders for pre-0.7 |
| `CONTRIBUTING.md` | Process + versioning rule (session = step) |
| `AGENTS.md` | AI session rule mirror |
| `V1.md` | Locked 1.0 scope |
| `STATE.md` | Working overview — canonical |
| `STATE.html` | Visual version of STATE.md |
| `VIEWER.html` | Interactive folder-shape viewer + STAC + OCI comparison |
| `mosaic.schema.json` | JSON Schema 2020-12 validator for `mosaic.json` |
| `mips/` | 14 shipped + template (Rust-style) + README |
| `skills/` | 5 process workflows (release, status, session-start, session-end, propose-mip) + README |
| `tools/` | Reference implementations (validate, render, core, cli, astro) — restructures to `packages/` in 0.10 |
| `examples/` | Sample sites; `examples/v0.9/` has 10 stress-test sites |
| `archive/0.8.1/` | Pre-realignment snapshot (TRUTHS, OVERVIEW, ARCHITECTURE, BUILD_REPORT, old spec/) |
| `docs/showcase.html` | Original visual showcase (still good) |
| `protection-drafts/` | Legal/IP drafts from this session (ecosystem doc, license drafts) |
| `LICENSE-spec.md` / `LICENSE-code` / `NOTICE` / `TRADEMARK.md` / `SECURITY.md` | Live on main via PR #2 |

## Memory pointers

- `/home/ms/.claude/projects/-home-ms-active-mosaic-spec/memory/MEMORY.md` — index
- Specific files in that dir cover: project context, user role, working style feedback, this realignment session's decisions, MD-as-content + validation-equals-indexing notes
- Prior session memories at `/home/ms/.claude/projects/-home-ms-mosaic-mip/memory/` — the 0.8.1 handoff lives there; load on session start

## Next session priority (suggested)

1. **Decide on layered spec split timing** — flat (current) vs split into `spec/folderdb/` + `spec/mosaic-cms/` for 0.10
2. **SPEC.md rewrite** — full pass through SPEC.md updating to reflect all 0.9 decisions
3. **MIP-0016 draft** — ref identity & rename safety
4. **`tools/` → `packages/` rename** — pure refactor
5. **`record` → `entry` rename** — IF still wanted; semantic decision

OR whatever direction the user takes — the above is a queue, not a requirement.

## How to resume

When you (future Claude session) pick this up:

1. Read this file (`HANDOFF.md`) — you're done
2. Read `STATE.md` — get the full picture
3. Run `git log --oneline` in worktree to see what's been done
4. Check `git status` for uncommitted work
5. Open `VIEWER.html` in browser to see the current model visually
6. Ask the user what they want to work on; default to the priority queue above

## Commit history of this session

Run `git log --oneline 0.9-realignment` for the full chain. Highlights:
- archive 0.8.1 → SPEC hoist → skills + MIP template → CHANGELOG reconstruct → PHILOSOPHY (8 truths) → license fix → cleanup commits → STATE.md → PRINCIPLES (3 truths) → profiles dropped → VIEWER.html → tabbed VIEWER with STAC + OCI → fixed static sizes → this handoff

