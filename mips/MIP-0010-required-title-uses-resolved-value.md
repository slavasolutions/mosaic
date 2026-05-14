# MIP-0010: Required-title uses the resolved value

- **Status:** shipped (0.8)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.8

## Summary

When a record's type declares `title` as `required: true`, validation MUST run against the **resolved title** per SPEC §2.3 (JSON `title` > markdown H1 > filename slug, title-cased), not against the raw JSON `title` field.

## Motivation

0.7 created an unresolvable conflict between two of its own rules:

- §3.3 said title precedence is JSON > H1 > slug. An author could legitimately rely on an H1 for the title.
- §7.2 listed "required field missing from a record" as drift. A type declaring `title: required: true` would flag any record without a JSON `title` field — including records that satisfied the title precedence rule via H1.

Two conforming engines could disagree on the same record: one applies precedence first then checks required-ness (no drift), the other checks required-ness on raw JSON (drift). Either reading is defensible from 0.7 spec text. That is an interop bug.

## Specification

See SPEC §2.3 and §6.3.

- Required-field validation for `title` runs against the resolved title.
- A record satisfies `title: required: true` if any of: JSON `title` is non-empty, the markdown body begins with an H1, or the record has a non-empty filename slug.
- For all other required fields, validation runs against the raw value. Title is special because it has a precedence chain.

This rule applies to user-defined types whose required field happens to be named `title` and is of type `string`. Engines MUST NOT extend the precedence chain to other fields.

## Rationale and alternatives

**Option: drop title precedence, require JSON `title` always.** Rejected — verbose for prose-only records; the H1 fallback is genuinely useful.

**Option: keep both rules, let engines decide.** Rejected — that *is* the interop bug.

**Option: extend precedence to all required fields with a fallback.** Rejected — title is the only field that has a meaningful fallback chain in the spec; generalising invents new policy.

## Drawbacks

Special-cases `title`. Acceptable because §2.3 already special-cases it.

## Resolution

Shipped in 0.8.
