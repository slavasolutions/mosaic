# 009 — circular refs pass

Anna refs Ben, Ben refs Anna. Per SPEC §6.7, this is permitted because refs are expanded
to stubs (SPEC §6.6), never inlined. No diagnostics expected.
