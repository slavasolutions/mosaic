# Security Policy — Mosaic

## What "security" means for a file format

Mosaic itself is a document format, not a running service. Most
security issues will be in implementations (readers, writers,
validators, renderers), not in the spec.

However, the spec can contain security-relevant issues. Examples:

- Ambiguity that lets two readers disagree on whether a document is
  valid (a security boundary).
- A reference resolution rule that enables path traversal in naive
  implementations.
- A schema feature that enables denial-of-service via pathological input.
- A canonicalization rule that's not collision-resistant where the
  spec implies it should be.

If you find one of these in the spec, treat it as a security issue.

## Reporting a vulnerability

**Do not** open a public GitHub issue for a security finding.

Use one of:

1. **GitHub Security Advisory (preferred)** —
   <https://github.com/slavasolutions/mosaic/security/advisories/new>
2. **Email** — <security@slavasolutions.com>

Include: a description, steps to reproduce, affected versions, the
impact you believe it has, and whether you've already disclosed it.

## What happens next

- **Within 72 hours**: acknowledgement.
- **Within 14 days**: an initial assessment.
- **Within 90 days**: a published fix or a clear plan with timeline.

## Credit

We credit reporters in the advisory unless you ask us not to.

## Safe harbor

We will not pursue legal action against researchers who:
- Make a good-faith effort to comply with this policy.
- Avoid privacy violations, data destruction, and service degradation.
- Give us a reasonable time to respond before public disclosure.
- Do not exploit the issue beyond what's necessary to demonstrate it.
