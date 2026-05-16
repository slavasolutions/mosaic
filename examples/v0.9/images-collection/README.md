# images-collection

Top-level `images/` collection where each record represents an image. A `pages/gallery.json` mounts the collection as URL routes.

## What this tests

- "Images-as-records": assets are records with binary content. Each record has a JSON metadata file plus a sibling binary.
- Mixed shapes inside a single collection:
  - `monsoon-2025/` → folder shape, with `index.json` + `image.jpg`
  - `coastline-iii.json` + `coastline-iii.jpg` → direct shape, JSON + sibling binary
  - `midnight-rain.json` + `midnight-rain.jpg` → direct shape
- The `images/` collection is mounted by `pages/gallery.json` with a custom `urlPattern` → records get `/gallery/<slug>` URLs.

## Binary file note

Because this is a text example, the actual JPGs are represented as `.jpg.placeholder` text files. Treat them as if they were `.jpg` binaries in a real site.

## Friction noticed

1. **Where does the binary live in the record model?** Two valid readings:
   - **(a) Binary is the body of the record**, analogous to how `.md` is the body for prose records. The MIME type implies "this record is binary".
   - **(b) Binary is a co-located asset referenced by the JSON** via `./image.jpg` in a `source` field. The record is the JSON only.
   
   The brief says "assets are records with binary content" which leans (a), but (a) requires a new file-channel concept beyond the locked "JSON is the only structured channel; markdown is the only prose channel". This example uses (b) for safety — the binary is co-located and referenced by a `source` field — but flags the ambiguity.

2. **Folder-shape vs direct-shape mixing.** `monsoon-2025/index.json` (folder) vs. `coastline-iii.json` (direct) within the same collection. SPEC.md §2.2 (0.8) allows this; the 0.9 brief preserves it.

3. **MIME and dimensions are inline in the record JSON**, not in a separate `images/manifest.json`. The 0.8 spec had a manifest.json; the 0.9 brief drops it (since every folder at root is a collection, so `images/manifest.json` would be a record named `manifest`, not a special file). This works — the metadata moves into the record JSON — but the rename of "asset manifest" to "per-record metadata" is a behavior change worth noting.

## Expected route table

- `/` → home
- `/gallery` → gallery list page
- `/gallery/monsoon-2025`
- `/gallery/coastline-iii`
- `/gallery/midnight-rain`
