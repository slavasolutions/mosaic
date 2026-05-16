# Note on the existing LICENSE file for clearcms/clear

The current `LICENSE` is a verbatim Apache License 2.0 (11,358 bytes,
SPDX `Apache-2.0`). **No replacement needed** — keep the existing file
as-is.

However, Apache 2.0 expects (but does not require) a top "copyright
notice" appendix and a sibling `NOTICE` file. The current LICENSE file
does not include a filled-in copyright line. Two recommended changes:

## 1. Add a copyright header in LICENSE (top of file)

Append these lines at the very top of `LICENSE`, BEFORE the
"Apache License" header:

```
Copyright 2026 M. Slavatynskyy

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

================================================================================
```

This is the standard Apache-2.0 "boilerplate notice" from Appendix of
the license. Keeping the verbatim license text below it.

## 2. Add a NOTICE file

See `NOTICE` in this draft folder. Apache 2.0 §4(d) requires that, if
the original work contains a NOTICE file, derivatives retain it. By
providing one upstream, you force every fork to preserve attribution
to the Clear project.
