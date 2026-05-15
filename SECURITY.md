# Security Policy — Mosaic

## What "security" means for a file format

Mosaic itself is a document format, not a running service. Most
security issues will be in implementations (readers, writers,
validators, renderers), not in the spec.

However, the spec **can** contain security-relevant issues. Examples:

- Ambiguity that lets two readers disagree on whether a document is
  valid (a security boundary).
- A reference resolution rule that enables path traversal in naive
  implementations.
- A schema feature that enables denial-of-service via pathological
  input (zip-bomb-style).
- A canonicalization rule that's not collision-resistant where the
  spec implies it should be.

If you find one of these in the spec, treat it as a security issue and
follow the disclosure process below.

## Supported versions

The current version (see `README.md` Status section) receives security
advisories. Older v0.x versions receive advisories only if a finding
also affects the current version. v1.0+ will have explicit support
windows.

## Reporting a vulnerability

**Do not** open a public GitHub issue for a security finding.

**Do** use one of these:

1. **GitHub Security Advisory (preferred)** — go to
   <https://github.com/slavasolutions/mosaic/security/advisories/new>
   and submit a private advisory. This gives the maintainers a
   coordinated-disclosure workspace and a tracking number.
2. **Email** — <security@slavasolutions.com>. Plain text or PGP
   accepted (PGP key, when published, will be linked from this file).
3. **Signal** — available on request via the email above.

Include:
- A description of the issue.
- Steps to reproduce (a minimal test document or implementation case
  is gold).
- Affected versions.
- The impact you believe it has.
- Whether you've already disclosed it elsewhere.

## What happens next

- **Within 72 hours**: acknowledgement that we received the report.
- **Within 14 days**: an initial assessment — severity, whether it's a
  spec issue or an implementation issue, expected fix window.
- **Within 90 days**: a published fix or a clear plan with timeline.
  Truly hard cases may exceed 90 days; in that case we coordinate
  publicly with you.

Critical issues affecting widely-deployed implementations may trigger a
coordinated multi-vendor disclosure. We'll loop you in.

## Credit

We credit reporters in the advisory unless you ask us not to. Reports
that materially improve the spec are also noted in the relevant MIP or
in `SPEC.md` Appendix F.

## Out of scope

- Security issues in third-party implementations of Mosaic — please
  report those to their respective maintainers. We are happy to relay
  reports if you're not sure where to send them.
- Vulnerabilities in your own product that consumes Mosaic — same.
- Trademark / branding disputes — see `TRADEMARK.md`.

## Safe harbor

We will not pursue legal action against researchers who:
- Make a good-faith effort to comply with this policy.
- Avoid privacy violations, data destruction, and service degradation.
- Give us a reasonable time to respond before public disclosure.
- Do not exploit the issue beyond what's necessary to demonstrate it.
