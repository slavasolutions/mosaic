# Mosaic Trademark Policy

**Last updated:** 2026-05-15

"Mosaic" (as applied to a portable document format for structured web
content), the Mosaic logo, and the names "Mosaic Improvement Proposal"
and "MIP" are trademarks of M. Slavatynskyy (the "Project Owner").

The format itself is open. The **name** is not. This policy explains
the line.

## TL;DR

- You **can** read, write, parse, validate, render, embed, build with,
  and ship products that produce or consume the Mosaic format. No
  permission needed. The format is free.
- You **can** say your product is "Mosaic-compatible" or "implements
  Mosaic v0.9" as a factual statement, as long as your implementation
  actually conforms to the spec at the level you claim.
- You **cannot** name your fork, product, package, organization, or
  service "Mosaic" or "Mosaic-something" without permission.
- You **cannot** use the Mosaic logo in product UI, marketing material,
  or merchandise without permission.
- You **cannot** publish an npm package, Docker image, domain name, or
  GitHub repo named `mosaic`, `mosaic-*`, or `*-mosaic` that suggests
  it is the official Mosaic project or a sanctioned fork.

## What is the Mosaic mark?

The mark covers:

1. The word "Mosaic" used in association with: a portable file format
   for web content; CMS / publishing software that produces or consumes
   the format; conformance programs; documentation; community
   infrastructure.
2. The Mosaic logo (any version published in this repository under
   `assets/branding/` once added).
3. The phrases "Mosaic Improvement Proposal" and "MIP" used in the same
   context.

The mark does NOT cover:

- The dictionary word "mosaic." You can name your photo collage app
  "Mosaic Studio" or your tiling library "mosaic-grid." The trademark
  is for the format-and-CMS context, not the English word.
- Pre-existing uses of "Mosaic" by unrelated projects (NCSA Mosaic,
  the MOSAIC browser, etc.).

## What you can do without asking

### Use the format

Anyone can build a tool that reads or writes Mosaic documents. The
format is dedicated to the public via CC BY 4.0 (spec text) and Apache
2.0 (reference code). No trademark license is needed to USE the format.

### Make factual conformance claims

You can say:

- "Foo CMS exports to Mosaic format."
- "Bar Builder is a Mosaic Level 2 Reader."
- "Baz validates Mosaic documents."

…provided the statement is true. If you claim Level 2 and your reader
fails the conformance suite at Level 2, that is misleading and may
constitute trademark misuse.

### Make non-commercial references

You can use the word "Mosaic" in documentation, blog posts, tutorials,
academic papers, and talks to refer to the format. You don't need to
ask. Attribution to <https://github.com/slavasolutions/mosaic> is
appreciated but not required for non-commercial reference.

## What you must ask for first

### Naming a fork, package, product, or service

If you are forking the spec, an implementation, or the surrounding
tooling, do not name the result "Mosaic," "Mosaic-X," or anything that
suggests it is the official project or a blessed branch.

Allowed: `widget-cms (reads Mosaic)`
Allowed: `mosaic-validator-rs (third-party validator)` — if you ask
   first and we agree it's clearly third-party.
Not allowed without permission: `mosaic-pro`, `mosaic-cloud`,
   `MosaicEnterprise`, `OpenMosaic`, `mosaic-2`.

The risk we are guarding against is *name-jacking*: a third party
publishes a fork called "Mosaic Pro" that drifts from the spec, and
users assume it's the canonical project.

### Using the logo

The Mosaic logo, when published, will require permission for: use in
product UI; use on merchandise; use in marketing materials; use as a
favicon for a product that is not itself the canonical Mosaic project.

You may use the logo in:
- Articles, talks, and tutorials about Mosaic.
- An "Implements Mosaic" badge on your product's docs site, linking
  back to <https://github.com/slavasolutions/mosaic>.

### Conformance branding

If/when a formal "Mosaic Certified" or "Mosaic Compatible" badge
program exists, only implementations that pass the conformance suite
may use the badge. Self-claimed conformance without passing the suite
is misleading and not permitted.

## Domain names, social handles, GitHub orgs

Do not register:
- Domains: `mosaic.dev`, `mosaicformat.org`, `getmosaic.io`, etc., for
  purposes that compete with or impersonate the project.
- GitHub orgs / npm scopes / Docker namespaces: `mosaic`, `mosaicio`,
  `mosaic-cms`, etc.

If you've already registered one in good faith for an unrelated
project, contact us at <legal@slavasolutions.com> so we can sort it
out.

## How to request permission

Email <legal@slavasolutions.com> with:
- What you want to do (use the name / logo / etc.).
- Where it will appear.
- Whether your project conforms to the Mosaic spec.

Most reasonable requests are granted quickly and at no charge.
Bad-faith requests (name-jacking, look-alike forks, impersonation) are
not.

## Enforcement

The Project Owner reserves the right to:
- Ask you to stop using the mark in a non-conforming way.
- Ask GitHub, npm, Docker Hub, registrars, or marketplaces to take
  down infringing artifacts (typosquats, look-alike packages,
  impersonating orgs).
- Take legal action where necessary, including in jurisdictions where
  the mark is registered.

Enforcement is proportionate. Good-faith mistakes get a friendly note,
not a cease-and-desist. Deliberate impersonation gets the full toolkit.

## This policy is itself open

This policy is licensed under CC BY 4.0. You're encouraged to copy and
adapt it for your own projects. Attribution: based on the Mosaic
Trademark Policy by M. Slavatynskyy
(<https://github.com/slavasolutions/mosaic>).
