# Stress tests

Sites designed to push the spec into uncomfortable places. Different from `tests/conformance/`:

- **Conformance tests** pin down each normative rule with a tight passing or failing case.
- **Stress tests** explore the corners — places where the spec is ambiguous, places where multiple readings are defensible, places where engines might disagree.

The point isn't to prove conformance; it's to learn what the spec doesn't yet say. Each stress test's README captures what's being tested, what the validator did, and (if relevant) what spec gap or MIP candidate it surfaced.

## Running

```bash
cd /home/ms/mosaic-0.7/mosaic-spec
for d in tests/stress/*/; do
  echo "===== $d ====="
  node tools/validate/impl/validate.js --site "$d/site" --human 2>&1 | head -20
done
```

## Current corpus

| # | Stress | What it tests |
|---|---|---|
| S01 | empty-pages-folder | An empty folder under `pages/` — is it a record or ignored? Spec ambiguous. |
| S02 | slug-case-collision | `Foo.json` + `foo.json` same dir — already covered by conformance 004 but more thorough here. |
| S03 | folder-vs-direct-same-slug | `team/anna/index.json` AND `team/anna.json` — both have slug "anna". Spec silent. |
| S04 | deep-collection-list | `pages/section/deep/page.json` mounts a collection — verify routes mint correctly. |
| S05 | conflicting-urlpatterns | Two pages mount the same collection with different `routes:true` patterns. Spec §3.5 says collision; what's the source? |
| S06 | redirect-cycle-3 | `/a → /b → /c → /a` — three-node cycle. Validator must dedupe. |
| S07 | self-redirect | `/a → /a` — degenerate self-loop. |
| S08 | deep-token-selector | `ref:tokens@color.brand.primary.shade-500` — DTCG can nest arbitrarily. |
| S09 | ref-in-deep-nested | A ref buried in `{a:{b:[{c:"ref:..."}]}}`. Tests §5.7 walker depth. |
| S10 | non-scalar-selector | `ref:site@social` where `social` is an array. Spec §5.6 silent on this. |
| S11 | trailing-slash-from | `collection-list#from: "collections/news/"` — does the engine normalize? |
| S12 | array-index-selector-out-of-bounds | `ref:header@nav.99.label` when nav has 3 items. |

## How results inform the spec

After each pass, the BUILD_REPORT or a follow-up doc summarises:

1. What the validator did (its actual diagnostics).
2. What the spec says or fails to say.
3. Whether to: (a) ship a one-line spec clarification, (b) draft a MIP, (c) leave under-specified intentionally.

The output of running these tests is itself a deliverable — it's evidence about where the spec is rough.
