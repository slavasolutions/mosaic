# Contributing to Clear

Thanks for your interest in contributing to Clear — the reference
implementation of the [Mosaic](https://github.com/slavasolutions/mosaic)
format.

This doc covers: what to work on, how to submit a change, what your
contribution license looks like, and where to ask for help.

## Before you start

- Clear is **pre-alpha**. Public API surface is annotated in `README.md`
  §"Public API surface." Internal signatures can change at any time.
- The portable Mosaic format is fixed by the
  [spec](https://github.com/slavasolutions/mosaic). Changes to the
  format itself happen there, via the MIP process — not here.
- Clear is downstream of Mosaic. If your contribution would only be
  useful if the Mosaic spec changed, file a Mosaic MIP first; come
  back to Clear once the MIP is accepted.

## What to work on

- **Bugs.** Open issues are fair game. Pick one, comment that you're
  taking it, send a PR.
- **Features.** Anything in `NEXT.md` is on the planned-work list.
  Comment on the issue (or open one) before starting on something
  large.
- **Adapters.** New `@clear/publish` adapters (Cloudflare Pages,
  Netlify, S3, …) are a great place to start. See `ADAPTERS.md`.
- **Tests.** Coverage gaps in `packages/*/tests/` are always welcome.
- **Docs.** README, package READMEs, and ADRs in `docs/adr/`.

## What we don't want

- Renames or stylistic rewrites of working code without a paired
  bugfix or feature.
- Speculative new public-API surface ("I think someone might want
  this").
- Drive-by trademark changes (renaming things to/from "Clear").

## Submitting a change

1. Fork the repo.
2. Create a branch from `main`: `git checkout -b fix/your-thing`.
3. Make focused commits. Use `git commit -s` to sign off (see
   "License of your contribution" below).
4. Run `pnpm install && pnpm typecheck && pnpm test:unit` before
   pushing. For UI changes, also run `pnpm test` (Playwright).
5. Open a PR. Reference the issue. Describe what changed and why.

## License of your contribution (read this)

Clear is licensed under the **Apache License 2.0**. By opening a pull
request against this repository, you affirm the following:

1. **You wrote it, or have the right to submit it.** Your
   contribution is your original work, OR it is properly attributed
   to its author and is being submitted under a compatible license.
2. **You grant the project the licenses to ship it.** Your
   contribution is licensed under Apache License 2.0, including the
   express patent grant in §3.
3. **You will be credited.** Contributors appear in the git history.
   Significant contributors may be acknowledged in `CONTRIBUTORS.md`.

This is a Developer Certificate of Origin (DCO)-style affirmation,
not a separately-signed CLA. If your employer requires a corporate
CLA before you contribute, email <legal@slavasolutions.com>.

### Sign-off (recommended)

Add `Signed-off-by: Your Name <email>` to your commit messages
(`git commit -s`). By signing off, you re-affirm the certifications
in <https://developercertificate.org/>.

## Trademark

"Clear," the Clear logo, "ClearCMS," "Clear Studio," and "Clear Cloud"
are trademarks. See `TRADEMARK.md`. Contributing code does NOT grant
you any rights in the marks.

## Code style

- TypeScript 5.6, ESM only.
- Formatting: Biome (`pnpm format`).
- Linting: Biome (`pnpm lint`).
- Tests: Vitest at the package level, Playwright at the integration
  level.
- Prefer small, dependency-free packages. Every new dep needs
  justification in the PR.

## Architecture decisions

Major decisions live in `docs/adr/`. If your change crosses package
boundaries or modifies the public API surface listed in `README.md`,
include an ADR draft in your PR.

## Security issues

Do NOT file security issues as public GitHub issues. See
`SECURITY.md`.

## Code of conduct

Be civil. Disagree about ideas, not people. Maintainers are doing
volunteer work; assume good faith.

If discussion gets heated, step away. Async is on purpose.
