# 022 - hidden files ignored

Files starting with `.` or `_` are ignored per §2.6. Sites with `.DS_Store` and `_draft.md`
in `pages/` validate cleanly and produce no spurious routes. Only `pages/index.md`
contributes the `/` route.
