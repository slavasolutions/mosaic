# cascade-override

The site has a root `header.json`. The landing subtree (`pages/landing/`) overrides it with a stripped-down conversion-focused header. Tests cascade lookup + deep merge.

## What this tests

The cascade default ref anchor: when a record contains `"header": "ref:header"`, the engine walks the parent chain from the record's location outward, taking the **first** `header.json` it finds.

| Record location | Cascade walk | Resolved header |
|---|---|---|
| `pages/index.json` | `pages/` → root | root `header.json` (full nav) |
| `pages/about.json` | `pages/` → root | root `header.json` (full nav) |
| `pages/landing/index.json` | `pages/landing/` → `pages/` → root | `pages/landing/header.json` (stripped) |

## Deep-merge behavior

The locked rule is **deep-merge objects, replace arrays**. Two readings exist:

**Reading A (override = full replacement at the cascade level).** The closer `header.json` is the resolved value; nothing from root is merged in.

**Reading B (override = merged onto the parent).** The closer `header.json` is merged onto root: scalar/object fields override, but unmentioned root fields (e.g. `logo`) survive.

This example assumes **Reading B**: the landing-subtree header inherits `logo: "Riverbend"` from root even though it isn't re-declared at `pages/landing/header.json`. The `nav` array is replaced wholesale (locked rule). The `cta` object is deep-merged (nothing missing from the override, but its `style` field would survive if omitted).

This is a friction point — see `REPORT.md`.

## Rules exercised

- Cascade default anchor (`ref:header`) walks parent chain
- Deep merge for objects, replace for arrays
- No special carveout for `pages/` — cascade works the same whether the consumer is a page or any other record

## Expected route table

- `/` → root nav header
- `/about` → root nav header
- `/landing` → stripped landing header (with `logo` from root if Reading B)
