# Block-type coverage matrix

Generated 2026-05-10 by `content-eng`; updated 2026-05-11 after tasks #4 (NPS retrofit), #5 (overlays demo), and #6 (mediaBlock + promoBanner). Inputs: `@clear/render` `templates.mjs` canon export (24 templates) cross-referenced with every `"blockType":` instance under `content/`, `globals/`, `overlays/`, and `clear.json`/`mosaic.json` of the five example sites.

## Canon list (24, from `engine/packages/render/src/templates.mjs`)

`siteHeader, hero, pillarGrid, pillar, comparisonTable, codeShowcase, testimonialSet, callout, footer, postList, impactStats, donateBlock, teamGrid, eventList, featuredStory, pressLogos, mediaBlock, promoBanner, lightbox, modal, drawer, newsletterPopup, cookieConsent, toast`

17 page-level · 1 global banner (`promoBanner`) · 6 overlays.

## Matrix

Cell = section instance count (counting source `"blockType":` strings in `content/`, `globals/`, `overlays/`, `clear.json`/`mosaic.json`). Global/overlay instance files count as one each. `MS` = `marketing-site/`. `MSC` = `marketing-site-converted/`. `NPS` = `nonprofit-site/`. `MIN` = `engine/examples/minimal-site/`. `BLG` = `engine/examples/blog-site/`. `—` = zero.

| Block           | MS | MSC | NPS | MIN | BLG |
|-----------------|---:|----:|----:|----:|----:|
| siteHeader      |  1 |  4  | 10  |  —  |  —  |
| hero            |  3 |  1  | 10  |  1  |  1  |
| pillarGrid      |  3 |  2  | 11  |  —  |  —  |
| pillar          |  — |  —  |  —  |  —  |  —  |
| comparisonTable |  1 |  —  |  9  |  —  |  —  |
| codeShowcase    |  1 |  1  |  1  |  —  |  —  |
| testimonialSet  |  1 |  —  |  1  |  —  |  —  |
| callout         |  8 |  1  | 13  |  —  |  —  |
| footer          |  1 |  4  | 10  |  —  |  —  |
| postList        |  — |  1  |  1  |  —  |  1  |
| impactStats     |  — |  —  |  2  |  —  |  —  |
| donateBlock     |  — |  —  |  1  |  —  |  —  |
| teamGrid        |  — |  —  |  2  |  —  |  —  |
| eventList       |  — |  —  |  1  |  —  |  —  |
| featuredStory   |  — |  —  |  2  |  —  |  —  |
| pressLogos      |  1 |  —  |  —  |  —  |  —  |
| mediaBlock      |  1 |  —  |  —  |  —  |  —  |
| promoBanner     |  1 |  —  |  —  |  —  |  —  |
| lightbox        |  1 |  —  |  —  |  —  |  —  |
| modal           |  1 |  —  |  —  |  —  |  —  |
| drawer          |  1 |  —  |  —  |  —  |  —  |
| newsletterPopup |  1 |  —  |  —  |  —  |  —  |
| cookieConsent   |  1 |  —  |  —  |  —  |  —  |
| toast           |  1 |  —  |  —  |  —  |  —  |

Site totals: MS = 28 instances (page sections + globals + overlays) · MSC = 13 · NPS = 74 · MIN = 1 · BLG = 2.

`clear.json` / `mosaic.json` `blockTypes` declarations (what each site claims to know):
- MS: callout, codeShowcase, comparisonTable, cookieConsent, drawer, footer, hero, lightbox, mediaBlock, modal, newsletterPopup, pillar, pillarGrid, pressLogos, promoBanner, siteHeader, testimonialSet, toast (18)
- MSC: callout, codeShowcase, footer, hero, pillarGrid, postList, siteHeader (7)
- NPS: callout, codeShowcase, comparisonTable, donateBlock, eventList, featuredStory, footer, hero, impactStats, pillar, pillarGrid, postList, siteHeader, teamGrid, testimonialSet (15)
- MIN: hero (1)
- BLG: hero, postList (2)

## Drift

No drift in `blockType` values. Every `"blockType":` string across MS, MSC, NPS, MIN, BLG matches a canon template name. Converter and hand-authors have not invented block types.

Two structural drifts remain:

- **MSC and NPS still lack `globals` + `overlays` keys.** MS uses both (`globals.promoBanner`, `globals.siteHeader`, `globals.siteFooter`, plus 6 overlay slots). MSC and NPS inline `siteHeader`+`footer` as sections at the top/bottom of every page (hence 4× and 10× counts). MIN and BLG omit headers/footers entirely. Astro importer does not emit `globals`/`overlays` keys — converter gap, not author drift.
- **`pillar` declared in three sites' `blockTypes` but never instantiated as a section.** It's a leaf record pulled into `pillarGrid` via `ref:pillars/<slug>`, not a section authors place. Declaration is consistent across sites; harmless but slightly misleading in the registry.

## Conclusion

- **All 24 canon blocks now have at least one real-world instance.** Coverage moved from 11/24 (initial audit) → 22/24 (after tasks #4 and #5) → 24/24 (after #6). `mediaBlock` lives at `marketing-site/content/pages/overlays-demo.json#sec_mediaBlock_demo` as a full-bleed editorial contrast to the overlays. `promoBanner` lives at `marketing-site/globals/promo-banner.json` declared in `marketing-site/clear.json#globals.promoBanner` with `position: page-top`, injected above `siteHeader` on every MS page. Every renderer template now has a fixture; every block has at least one Studio inspector preview source.
- **Sites that drift: only the MSC vs MS architectural gap remains.** NPS structural retrofit (task #4) collapsed the domain-shape drift — 9 of the prior 19 `pillarGrid` instances and 5 of the 13 `callout` instances moved to dedicated canon blocks. MSC remains a converter-output regression fixture; the structural delta against MS (no globals/overlays) is the astro-importer's responsibility, not the content's.
- **Recommended canonical content trees (unchanged from initial audit):** Real production: **MS canonical** for marketing (now exercises 18 of 24 canon block types in source). Demote MSC to a converter regression fixture only. **NPS canonical** for vertical demo (now uses 15 of 24 canon types). Spec/teaching: **MIN** = smallest possible Mosaic site (1 type), **BLG** = Mosaic + a blog collection (2 types). Retire `mosaic-spec/clear-marketing-site/` — predecessor of MS, stale.
- **Next moves:** (1) teach `astro-importer` to emit `globals`+`overlays`, re-run on MSC; (2) decide on `pillar`'s `blockTypes` declaration (drop it from the registry, or formalize it as a "record-not-section" type in the schema spec); (3) optional cosmetic pass on NPS palette tokens for the new block types and source `photo:` asset paths for `team-members` entries (currently render as blank placeholders).
