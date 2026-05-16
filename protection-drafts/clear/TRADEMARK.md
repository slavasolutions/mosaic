# Clear Trademark Policy

**Last updated:** 2026-05-15

"Clear" (as applied to the headless CMS / live editing engine
implementing the Mosaic format), the Clear logo, "ClearCMS," "Clear
Studio," "Clear Studio Pro," and "Clear Cloud" are trademarks of
M. Slavatynskyy (the "Project Owner").

The software is open. The **names** are not. This policy explains the
line.

## TL;DR

- You **can** use, fork, modify, sell, and ship products built on the
  Clear codebase (it's Apache 2.0). No permission needed.
- You **can** say your product "runs on Clear" or "is built with Clear"
  as a factual statement.
- You **cannot** name your fork or commercial product "Clear,"
  "Clear-something," "ClearCMS," or "Clear Cloud" without permission.
- You **cannot** use the Clear logo on a product UI, marketing site,
  or merchandise without permission.
- You **cannot** publish an npm package, Docker image, or GitHub repo
  named `clear`, `clear-cms`, `clear-cloud`, or `@clear/*` that
  competes with or impersonates the official project.

## What this policy protects

The Clear name and brand exist for one reason: when someone says "I
use Clear" they should mean the project at
<https://github.com/clearcms/clear>, with the conformance and behavior
this project guarantees — not a name-jacked fork with different
behavior.

Apache 2.0 §6 explicitly excludes trademark grants. The Apache
license gives everyone the right to USE THE CODE; it does NOT give
anyone the right to USE THE NAME.

## What the mark covers

1. The word "Clear" used in the context of: a CMS, headless CMS, web
   publishing software, content management, page builder, live
   collaborative editor, or Mosaic-format implementation.
2. The Clear logo (any version published in this repository under
   `assets/branding/`).
3. The associated marks: ClearCMS, Clear Studio, Clear Studio Pro,
   Clear Cloud, Clear Hosted, Clear Self-Host.

The mark does NOT cover:

- The English word "clear" in unrelated contexts.
- Pre-existing uses of "Clear" by unrelated projects.

## Allowed without asking

### Use the software

The Apache 2.0 license gives you full rights to: read, compile, fork,
modify, redistribute, sell, sublicense, embed, and ship products built
on Clear. You do not need a trademark license to USE THE SOFTWARE.

### Factual descriptions

You can say:
- "Our site uses Clear."
- "Built on Clear."
- "Migrated from WordPress to Clear."
- "Clear plugin for Foo."

…as long as the statement is true.

### Plugin / extension / theme naming

If you build an extension, plugin, or theme for Clear, you can use
"for Clear" or "Clear-compatible" in the description. Avoid
package names that imply you ARE Clear; prefer:
- `my-thing-for-clear`
- `clear-plugin-my-thing` (only if it's clearly third-party)
- `@my-org/clear-foo`

Do not use `@clear/foo` or `@clearcms/foo` — those scopes are
reserved.

### Articles, talks, tutorials

You can use the Clear name freely in non-commercial / editorial
content. Attribution to the project URL is appreciated but not
required.

## What you must ask for first

### Naming a fork or commercial product

Allowed: `WidgetCMS (powered by Clear)`
Allowed: `Acme Studio (uses Clear under the hood)`
Not allowed: `Clear Pro`, `ClearCMS Enterprise`, `Clear Cloud`, `Clear
Hosted`, `OpenClear`, `Clear v2`.

The risk we are guarding against is *commercial name-jacking*: a
third party launches "Clear Cloud" as a paid SaaS, confuses users
about who runs it, and undercuts the official hosted offering.

### Using the logo

The Clear logo, when published, requires permission for: use in
product UI; use on merchandise; use in marketing materials; use as a
favicon for a product that is not itself Clear.

You may use the logo in:
- Articles, talks, and tutorials about Clear.
- A "Powered by Clear" badge on your product's site, linking back to
  <https://github.com/clearcms/clear>.

### Hosted / SaaS branding

The Project Owner operates the official hosted runtime under the
"Clear Cloud" / "Clear Hosted" branding (see README §1.3). No third
party may operate a competing hosted offering under any "Clear"
brand without permission. You CAN run your own hosted Clear under a
different name and disclose it's built on Clear.

## Domains, social handles, package scopes

Do not register, for purposes that compete with or impersonate the
project:
- Domains: `clear.com`, `clearcms.io`, `getclear.dev`, `clearcloud.app`,
  etc.
- Package scopes: `@clear`, `@clearcms`, `@clear-cloud` on any
  package registry.
- GitHub orgs: `clear`, `clear-cms`, `clear-cloud`.
- Docker namespaces: `clear`, `clearcms`.

If you've already registered one in good faith for an unrelated
project, contact <legal@slavasolutions.com> so we can sort it out.

## How to request permission

Email <legal@slavasolutions.com> with:
- What you want to do (use the name / logo / etc.).
- Where it will appear.
- Your relationship to the project (contributor, integrator, agency,
  competitor, etc.).

Most reasonable requests are granted quickly and at no charge.

## Enforcement

The Project Owner reserves the right to:
- Ask you to stop using the mark in a non-conforming way.
- Ask GitHub, npm, Docker Hub, registrars, app stores, and
  marketplaces to take down infringing artifacts.
- Take legal action where necessary.

Enforcement is proportionate. Good-faith mistakes get a friendly
note. Deliberate impersonation, typo-squatting, and look-alike SaaS
offerings get the full toolkit.

## Apache 2.0 §6 reminder

This policy does not modify the Apache 2.0 license. The Apache 2.0
license itself states:

> 6. Trademarks. This License does not grant permission to use the
> trade names, trademarks, service marks, or product names of the
> Licensor, except as required for describing the origin of the Work
> and reproducing the content of the NOTICE file.

This trademark policy explains what that means in practice for Clear.

## This policy is itself open

This policy is licensed under CC BY 4.0. You're encouraged to copy
and adapt it for your own Apache-licensed projects. Attribution:
based on the Clear Trademark Policy by M. Slavatynskyy
(<https://github.com/clearcms/clear>).
