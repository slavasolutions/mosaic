# Contributing to Mosaic

Mosaic is a portable document format. The spec is the product. Changes
to the spec are how the format evolves.

This document covers how to propose changes, file bugs, contribute
examples, what license your contributions land under, and the
session-equals-version-step convention used by maintainers.

## What kind of change are you making?

**A bug or ambiguity in the spec text** (typo, contradiction, unclear
phrasing that doesn't change behavior) — open a PR directly. No MIP
needed. Title it `spec: clarify §X.Y` or `spec: fix typo in §X.Y`.

**A normative change** (anything that changes what readers or writers
MUST/SHOULD do, anything that adds or removes a feature, anything that
affects whether a document is conformant) — open a MIP. See below.

**A new example or example improvement** — open a PR directly.
Examples live in `examples/` and are document-only (no rendered output,
no engine-specific code).

**A new implementation** — open a PR adding a row to the
implementations table in `README.md`. Your implementation doesn't need
to be hosted in this repo or this org.

**A question or discussion** — open a GitHub issue with the `question`
label. If discussion converges on a proposed change, the next step is a
MIP.

## Versioning rule

**Each non-discarded work session ships one CHANGELOG entry and one version step.**

- **Patch** (`x.y.Z`) — docs, typos, tooling fixes, internal refactors. No spec semantic change.
- **Minor** (`x.Y.z`) — shipped MIP, new feature, new tool. Pre-1.0 minor versions are allowed to break.
- **Major** (`X.y.z`) — only post-1.0. Semver semantics apply.

Sessions that are abandoned, scrapped, or rolled back leave no entry.
Sessions that ship — even a single rename — get a version bump.

Every CHANGELOG entry names the outcome of the session and links any
MIPs touched.

## Mosaic Improvement Proposals (MIPs)

Every normative change to the spec lands as a MIP first. The spec edit
is a separate PR that references the accepted MIP.

### MIP lifecycle

1. **Discussion.** Open a GitHub issue describing the problem, not the
   solution. Tag it `mip-discussion`. Get rough agreement that there's
   something worth solving.
2. **Draft.** Copy `mips/template.md` to `mips/MIP-NNNN-short-slug.md`
   where NNNN is the next available number. Fill it in. Open a PR.
3. **Review.** Reviewers focus on: does this belong in the portable
   format or in an engine? Is the motivation evidence-based? Who's the
   second implementer who needs this? Are alternatives considered?
4. **Decision.** Status moves to one of:
   - **Accepted** — merge the MIP. Spec edits land in a separate PR.
   - **Rejected** — merge with status Rejected and reasoning preserved.
   - **Withdrawn** — author withdraws.
   - **Deferred** — interest but not enough evidence yet.
5. **Implementation.** Once spec edits land, status moves to
   Shipped.

### What makes a good MIP

- **Real motivation.** "Implementation X hit problem Y and worked
  around it by Z" is good motivation. "It would be nice if..." is not.
- **Concrete normative text.** A MIP should include the actual spec
  language being proposed, diffable against the current spec.
- **Alternatives considered.** What else did you think about? Why is
  this better?
- **Backward compatibility analysis.** Does this break existing valid
  documents? If yes, that's a stronger bar — it needs a clear
  migration story.
- **Reference implementation status.** Has anyone built this? Where?
  If the answer is "nobody," that's usually a signal to defer.

## Source-of-truth layers

Three docs, three jobs. If content overlaps between them, that is a
bug — fix by deleting the duplicate.

- **`PRINCIPLES.md`** — foundational claims. Plain language. No MUST/MAY.
- **`SPEC.md`** — normative rules. RFC-2119 language.
- **`mips/MIP-NNNN.md`** — decisions and alternatives. No normative language.

## Spec style

- Use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) in
  normative text. Don't invent new keywords.
- Mark non-normative sections clearly.
- Use tables for closed taxonomies. They're easier to validate against
  than prose.
- Use ABNF (RFC 5234) for grammars.
- Use JCS (RFC 8785) if you ever need canonical JSON.
- Keep sentences short.

## How to commit

- Atomic commits — one logical change per commit.
- Subject line: lowercase, imperative (`spec: hoist SPEC.md to root`).
- Body explains *why*, not *what* — the diff shows what.
- No force-push to `main`; branch protection enforces this.
- Sign off your commits: `git commit -s` adds a DCO-style
  `Signed-off-by:` line.

## How to PR

- All changes go through PRs. No direct push to `main`.
- The repo owner reviews and merges. Contributors do not merge their
  own PRs.
- Draft early; mark ready when CI is green.

## License of your contribution (read this)

Mosaic is dual-licensed:

- **Spec text** (`SPEC.md`, `PRINCIPLES.md`, `mips/`, schema annotations) — CC BY 4.0.
- **Code** (validators, schema tooling, runnable examples, build
  scripts) — Apache License 2.0.

By opening a pull request against this repository, you certify that:

1. **You wrote it, or have the right to submit it.** Your contribution
   is your original work, OR it is properly attributed to its author
   and is being submitted under a compatible license.
2. **You grant the project the necessary licenses to ship it.** For
   spec text, your contribution is licensed under CC BY 4.0. For code,
   your contribution is licensed under Apache License 2.0, including
   the express patent license grant in Section 3 of Apache 2.0.
3. **You will be credited.** Contributors are listed in the git
   history. Significant contributors may be acknowledged in
   `CONTRIBUTORS.md` (not yet created — added once the list grows past
   the original author).

This is a Developer Certificate of Origin (DCO)-style affirmation
rather than a full CLA. We do not require a separate signed agreement
for individual contributions at this stage. If your employer requires
a corporate CLA before you contribute, email
<legal@slavasolutions.com> and we'll work one out.

### Sign-off (recommended)

Add `Signed-off-by: Your Name <email>` to your commit messages
(`git commit -s`). This is the DCO sign-off used by the Linux kernel
and many OSS projects. By signing off, you re-affirm the certifications
in <https://developercertificate.org/>.

## Dependency-free principle

Mosaic is substrate. Substrate must age well. Every `@mosaic/*`
package targets zero runtime dependencies.

- Peer dependencies are OK for framework integrations (the host
  installs Astro/Next themselves).
- Inline small functions instead of pulling a library.
- No React, Vue, or Solid anywhere in the Mosaic stack.
- Heavyweight or churn-prone libraries are forbidden.

Adding a runtime dependency requires a MIP.

## Trademark

"Mosaic," the Mosaic logo, and "Mosaic Improvement Proposal" / "MIP"
are trademarks. See `TRADEMARK.md`. Contributing code or spec text does
NOT grant you any rights in the marks.

## Code of conduct

Be civil. Disagree about ideas, not people. Reviewers are doing
volunteer work; assume good faith.

If discussion gets heated, step away. The MIP process is asynchronous
on purpose.

## Security issues

Do not file security issues as public GitHub issues. See `SECURITY.md`.
