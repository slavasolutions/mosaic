# Protection drafts — index

All files in this directory are **drafts**. Nothing has been pushed
to live repos. Review, edit, and commit manually.

## Top-level

- `REPORT.md` — read this first. Audit + reasoning + checklist.
- `INDEX.md` — this file.

## Per-repo drafts

### `mosaic/` — for slavasolutions/mosaic

- `LICENSE-spec.md` — new CC BY 4.0 license for spec text.
- `LICENSE-code` — new Apache 2.0 license for code in the repo.
  (Drop the full Apache 2.0 verbatim text in before committing.)
- `NOTICE` — Apache-style attribution notice.
- `TRADEMARK.md` — Mosaic / MIP name & logo policy.
- `CONTRIBUTING.md` — keeps existing MIP process, adds DCO + dual-
  license affirmation.
- `SECURITY.md` — disclosure policy for spec + reference impl.
- `README-footer-snippet.md` — replacement for current README
  "## License" section.

### `clear/` — for clearcms/clear

- `LICENSE-header-note.md` — what to prepend to the existing
  Apache 2.0 LICENSE file (the file itself stays).
- `NOTICE` — Apache 2.0 §4(d) NOTICE (the load-bearing file
  for protection against name-stripping forks).
- `TRADEMARK.md` — Clear / ClearCMS / Clear Studio / Clear
  Cloud policy.
- `CONTRIBUTING.md` — DCO + Apache 2.0 contribution affirmation.
- `SECURITY.md` — disclosure policy for a live runtime.
- `README-footer-snippet.md` — replacement for current README
  "## License" section.

### `clear-ucc/` — for clearcms/clear-ucc

- `LICENSE` — proprietary, all-rights-reserved, with content-vs-
  code ownership split.
- `NOTICE` — disclaims OSS, notes UCC marks are UCC's.
- `README-header-warning.md` — paste at the top of the existing
  README + `gh repo edit` command for the description.

## Conventions used in drafts

- Year: 2026.
- Copyright holder: "M. Slavatynskyy" everywhere. Swap to your
  registered entity name (e.g., "Slava Solutions Inc.") before
  committing if you have one — and do it consistently across all
  files.
- Contact email: `legal@slavasolutions.com` and
  `security@slavasolutions.com`. Set these aliases up before
  publishing; they appear in the public TRADEMARK / SECURITY files.
- Project URLs: `github.com/slavasolutions/mosaic` and
  `github.com/clearcms/clear`.

## Verify before committing

For each repo:
1. Open the draft files. Read line-by-line.
2. Replace the placeholder author / entity name everywhere if
   different from "M. Slavatynskyy."
3. For `mosaic/LICENSE-code`: replace the placeholder block with
   the verbatim Apache 2.0 text from
   <https://www.apache.org/licenses/LICENSE-2.0.txt>.
4. For `clear/LICENSE-header-note.md`: edit the existing LICENSE
   file in the repo to prepend the copyright header. Do not
   replace it.
5. Run any project-level CI / Biome / linters; LICENSE / NOTICE /
   *.md files should not break anything but verify.
6. Open PRs to feature branches first so you can see the diff
   before merging to main.
