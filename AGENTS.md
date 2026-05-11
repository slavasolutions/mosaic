# AGENTS.md

Rules for LLMs and coding agents working in this repo.

This file is the canonical agent instruction set. If your tooling reads `CLAUDE.md`, `.cursorrules`, or another agent-instruction filename, treat this file as the source of truth and the others (if present) as derived.

## What this repo is

Mosaic is a portable document format specification. The product is `spec.md`. Everything else (examples, schemas, MIPs, this file) exists to support that one document.

The format is independent of any rendering engine. The reference implementation is Clear, but Clear is downstream of the spec, not the other way around.

## Core rules

### 1. The portable format is the product

Never propose spec changes whose only justification is "Clear needs this" or "the reference implementation needs this." If only one implementation needs a feature, it belongs in that implementation's documentation, not in the format spec.

When a user describes a problem that sounds like a spec change, the first question is always: "Is this a format question, or is this an engine question?" Most are engine questions.

### 2. Evidence before features

Before proposing a change, find an existing implementation or use case that demonstrates the need. "Hypothetically a renderer might want X" is not sufficient motivation. "Clear hit this problem and worked around it by Y" is sufficient. "A second implementer hit this problem too" is strong.

Speculative features compound into permanent surface area. Wait for the second implementer.

### 3. Optional features are a smell

Prefer "this feature exists or it doesn't" over "this feature MAY be supported." Three optional features compound into eight possible reader behaviors. If you find yourself reaching for MAY, ask whether the feature belongs in the spec at all, or in a separate extensions document, or in an engine.

### 4. Engine concerns belong in engine docs

These topics are explicitly engine-scoped and should not appear in the format spec without strong evidence and a MIP:

- Storage strategy (content-addressed, snapshot, log-based)
- Merge semantics for concurrent edits (CRDT details, conflict resolution rules)
- Hashing schemes (canonical JSON encoding, integrity checks)
- Live editing protocols
- Rendering recipes (CSS patterns, component composition)

If a user asks for help on any of these, the answer usually lives in the relevant engine's repo, not here.

### 5. Read the decision log before proposing overrides

`spec.md` Appendix F lists every contested design call with reasoning. Before proposing a change that overrides a prior decision, read the original reasoning and address it explicitly. "I disagree" is not sufficient; "the original reasoning assumed X, but Y has changed" is.

### 6. Normative changes go through MIPs

Every change to the normative spec text (anything that affects what readers/writers MUST/SHOULD do, anything that adds or removes a feature) lands as a MIP first. See `CONTRIBUTING.md` for the process.

Bug fixes (typos, contradictions, unclear phrasing that doesn't change behavior) can go straight to a spec PR.

### 7. Spec style

- Use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY). Don't invent new keywords.
- Normative sections use these keywords. Non-normative sections (examples, recommendations, recipes) should be marked clearly.
- Use tables for closed taxonomies. Use ABNF for grammars.
- Keep sentences short. The spec is read under pressure.
- Every normative claim should be falsifiable: a validator should be able to determine conformance from the text.

### 8. The "weekend test"

When evaluating whether a feature belongs in the core spec, ask: could a static-site generator implement this in a weekend? If yes, it's probably core. If no, it probably belongs in extensions, a separate spec, or an engine.

## Working in this repo

### When the user asks for a spec edit

1. Identify whether it's a bug fix or a normative change. If unclear, ask.
2. For bug fixes: edit `spec.md` directly. Update the decision log only if the fix clarifies a previously-contested point.
3. For normative changes: draft a MIP first using `proposals/template.md`. Don't edit `spec.md` until the MIP is accepted.

### When the user asks "should X be in the spec?"

Default to no. Then ask: who's the second implementer? What does the engine documentation alternative look like? Has anyone built this yet?

If the answer is "Clear needs this and it's the only implementation," the answer is almost always "put it in Clear's docs first; revisit after a second implementer exists."

### When the user asks about Clear-specific behavior

Redirect to the Clear repo. This repo doesn't document Clear. Mentioning Clear by name in normative spec text should be rare; the spec is meant to outlive any single implementation.

### When generating examples

Examples in this repo are document-only. They consist of a valid `mosaic.json` plus a content tree. They do not include:

- Rendered output (HTML, screenshots, demos)
- Engine-specific code (Astro components, React components, CLI invocations)
- Configuration for any particular renderer

If an example needs to demonstrate rendering, that example belongs in the renderer's repo, not here.

### When unsure, ask

Format spec work is high-stakes and slow-moving. A wrong feature added to v0.5 is hard to remove from v1.0. When the request is ambiguous, ask one clarifying question before proceeding.

## What this file is not

This file is not a writing-style guide for casual conversation. The user can ask questions, push back on the spec, and explore ideas freely. These rules apply specifically to:

- Drafting or editing `spec.md`
- Drafting MIPs
- Drafting examples
- Drafting documentation that supports the spec

In free conversation, follow the user's normal preferences.
