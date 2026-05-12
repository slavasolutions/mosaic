# edge-cases/token-cascade-partial-shadow

A page declares `tokenOverrides`; a section nested inside it also declares `tokenOverrides`. The section's map includes a name the page also overrode (`color.accent`) AND a name the site doesn't declare (`color.rebellion`).

## Spec reference

§4.2a — Resolution rules:

- Resolution is **last-write-wins** along the cascade: section overrides page, page overrides site.
- An override map MAY include token names that are not declared at the site level. Such unknown names MUST be silently dropped per-name (the rest of the map still applies).

## Edge questions

For the section's `color.accent`: last-write-wins means the section's `#00ff00` overrides the page's `#ff0000` overrides site's `#0066cc`. **Clear in v0.5.**

For the section's `color.rebellion`: site doesn't declare `rebellion`. Spec says "silently drop per-name." **Clear in v0.5.**

But the **interaction** isn't worked through:

1. **Validation order:** does the validator emit the warning for `rebellion` BEFORE applying `accent`'s override, or AFTER? Probably doesn't matter, but should be deterministic.

2. **Strict-mode refusal?** Spec says "the rest of the map still applies" — implying validators MUST NOT refuse to render the section solely because of the invalid name. But a strict-mode implementation (`refuse-on-warning` flag from §6) MIGHT want to. The spec is silent on whether `tokenOverrides` warnings can trigger refusal.

3. **No worked example exists** in §4.2a for this case. The rules are correct; the example is missing.

## Candidate behavior

The rules as written are correct. The fix is a worked example in §4.2a that demonstrates both a valid + invalid name in the same override map, with the resolved values explicitly shown.

## MIP candidate

**"Add a worked example for §4.2a partial-shadow case."** Lightweight — probably just a spec PR (per CONTRIBUTING.md: clarifying a worked example is a typo/clarity fix, not a normative change). But could also resolve the strict-mode-refusal question as part of the same PR.
