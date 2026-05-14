# 012 - selector unresolved drift

The record `about/company` exists, but the selector `@nonexistent-heading` matches neither
a JSON path nor a markdown heading. Spec §5.6 mandates `mosaic.selector.unresolved` (drift).
