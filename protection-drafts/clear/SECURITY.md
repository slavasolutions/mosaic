# Security Policy — Clear

Clear is a CMS / live editing engine. It runs as a Node process, a
Cloudflare Worker, or a Vercel function, and it reads/writes files
on disk. Security matters.

## What we care about

- **Code execution.** Any path that lets a document, schema, or admin
  payload execute arbitrary code on a server or in a user's browser
  beyond the documented sandbox.
- **Path traversal.** Any way to read or write files outside the
  configured Mosaic document root via crafted slot values,
  references, or asset paths.
- **Auth bypass.** Any way to reach `/admin/*`, `/session/patch`, or
  WebSocket frames without the documented auth.
- **Privilege escalation.** Any way for an editor-tier session to
  perform owner-tier operations (bootstrap, migrate, schema rewrite).
- **DoS via crafted documents.** Schema features or reference
  resolution that can blow up the runtime with bounded input.
- **Render-tier XSS.** Any way for content to inject script into
  rendered HTML beyond declared safe-HTML slots.
- **Adapter misuse.** Publish adapters (`@clear/publish-*`) that leak
  credentials or write outside their intended target.

## Supported versions

- **Current `main`** — receives security advisories.
- **Tagged 0.x releases** — receive advisories only if the issue also
  affects the current `main`.
- **Archived repos** (`clear-archive`, `clear-2026-05`, `clear-legacy`)
  — not supported. Do not rely on them in production.

A formal support window starts at v1.0.

## Reporting a vulnerability

**Do not** open a public GitHub issue for a security finding.

**Do** use one of these:

1. **GitHub Security Advisory (preferred)** —
   <https://github.com/clearcms/clear/security/advisories/new>.
2. **Email** — <security@slavasolutions.com>. Plain text or PGP.
3. **Signal** — available on request via the email above.

Include:
- A description of the issue.
- Reproduction steps (a minimal Mosaic document + the command that
  triggers the bug is ideal).
- Affected versions / commit SHAs.
- Impact you believe it has.
- Whether you've already disclosed it elsewhere.

## Response timeline

- **Within 72 hours**: acknowledgement.
- **Within 14 days**: initial assessment — severity, affected
  packages, fix window.
- **Within 90 days**: a published fix, or a clear plan with timeline.

Hosted Clear (Clear Cloud) users get the fix deployed before the
public advisory.

## Coordinated disclosure for adapters

If a finding affects an upstream platform (Cloudflare, Vercel, GitHub
Pages, S3, etc.), we coordinate with that vendor before public
disclosure.

## Credit

We credit reporters in the advisory unless asked not to.

## Safe harbor

We will not pursue legal action against researchers who:
- Make a good-faith effort to comply with this policy.
- Avoid privacy violations, data destruction, and service degradation.
- Give us a reasonable time to respond before public disclosure.
- Do not exploit the issue beyond what's necessary to demonstrate it.
- Limit testing to your own Clear instances; do not probe other
  users' hosted sites.

## Out of scope

- Vulnerabilities in third-party Clear forks or commercial products
  branded as something else built on Clear — report to those vendors.
- Findings that require an attacker already in control of the
  document root filesystem.
- Self-XSS, clickjacking on logged-out marketing pages, social-eng
  reports.
- Reports generated solely by automated scanners with no
  reproduction.
