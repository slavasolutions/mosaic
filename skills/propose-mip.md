# Skill: propose-mip

Author a new MIP using the repository's standard template.

## When to use

- A spec change is needed (new ref form, new section type, new rule, change to resolution semantics)
- A process decision needs recording (we use semver, conformance lives in this repo, etc.)
- Several small spec ambiguities want grouping into one micro-amendment

Don't open a MIP for typo fixes, prose clarifications that don't change behaviour, or tooling-only changes. Those go as regular PRs.

## Steps

1. **Get the next number.**
   ```
   ls mips/MIP-*.md | sort | tail -1
   ```
   Next is +1. Numbers are never reused.

2. **Copy the template.**
   ```
   cp mips/template.md mips/MIP-NNNN-short-slug.md
   ```
   Slug is lowercase, hyphen-separated, ≤ 4 words.

3. **Fill the template.** The Rust-style sections in order:
   - **Status** — start as `draft`
   - **Author** — your name
   - **Created** — today's date
   - **Target version** — which spec release will absorb this
   - **Summary** — one paragraph; what changes
   - **Motivation** — why; what problem this solves
   - **Guide-level explanation** — as if it's already in the spec, with examples
   - **Reference-level explanation** — the precise normative change
   - **Drawbacks** — honest costs
   - **Rationale and alternatives** — what else was considered and rejected
   - **Prior art** — comparable approaches in other projects
   - **Unresolved questions** — what's open
   - **Future possibilities** — what this enables later
   - **Resolution** — left blank until accepted

4. **Update `mips/README.md`** — add a row to the index table.

5. **Open a PR.** Include:
   - The MIP file
   - The README index edit
   - Any SPEC.md changes (only if the MIP is being accepted in the same PR)

## Inputs needed

- A clear single change idea (one MIP per change)
- Familiarity with the section of SPEC the change affects
- The template at `mips/template.md`

## Output

- A new `mips/MIP-NNNN-<slug>.md`
- Updated `mips/README.md` index
- One PR

## Pitfalls

- Don't restate normative SPEC language verbatim in the MIP. Link the SPEC section instead.
- Don't reserve numbers. The next number is the next number.
- A MIP that just clarifies wording in SPEC isn't a MIP — it's a typo PR.
- If a MIP covers multiple unrelated changes, split it. One MIP, one decision.
- Don't promote a draft MIP to `proposed` without at least skimming the prior MIPs to check for overlap or contradiction.
