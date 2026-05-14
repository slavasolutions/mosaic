# 008 - ref unresolved drift

`pages/index.json` references `ref:team/ghost`, but no record `ghost` exists in the
`team` collection. The site builds, but emits one drift diagnostic
`mosaic.ref.unresolved`. Spec §6.3.
