# 005 - empty record fails

A folder-shape record location (`collections/things/empty/`) with neither `index.md` nor
`index.json` violates SPEC §2.1 (at least one MUST exist). Reports one structural
diagnostic `mosaic.record.empty`. The `.gitkeep` file is hidden (starts with `.`) and
ignored per §2.6, so the folder reads as genuinely empty.
