# README header warning for clearcms/clear-ucc

Paste this block at the very TOP of the existing `README.md` (above
the `# UCCON Website` line). It keeps the existing README intact
while making the proprietary status unambiguous.

---

> **Proprietary — All Rights Reserved.**
> This repository is a client deliverable for the Ukrainian Canadian
> Congress — Ontario Provincial Council. It is NOT open source.
> It is NOT covered by the Mosaic or Clear licenses, even though it
> lives under the `clearcms/` org.
>
> Code copyright (c) 2026 M. Slavatynskyy / Slava Solutions.
> Editorial content copyright UCC-OPC.
> See [`LICENSE`](./LICENSE) for terms.
>
> Licensing inquiries: <legal@slavasolutions.com>.

---

## Why this matters

`clearcms/clear-ucc` is privately visible today, but:

1. Visibility settings can change by accident (a misclick, an org
   admin sweep, a future "let's make our agency portfolio public"
   moment).
2. The repo description is currently empty. Anyone with read access
   (and that may grow over time as collaborators and AI agents are
   added) has no immediate signal that it's a client deliverable, not
   a Clear-org open-source project.
3. The folder lives next to `clearcms/clear`, which is Apache 2.0. A
   third party browsing the org could reasonably assume the same
   license applies. The header makes it obvious it does not.

This warning + the LICENSE file together close that gap.

## Repo description (set via gh)

The current description is empty. Set it to:

> "UCC-OPC client website — proprietary. NOT open source."

Command (after you've reviewed; do not run blindly):

    gh repo edit clearcms/clear-ucc \
      --description "UCC-OPC client website — proprietary. NOT open source."
