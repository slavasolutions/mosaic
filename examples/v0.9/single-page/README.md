# single-page

One page, structured data plus prose body.

## What this tests

- A page with **both** `index.json` and `index.md` at `pages/`
- The JSON has no `body` field, so the engine auto-links the same-slug `.md` body to it (engine convenience rule)
- Title comes from JSON `title`, not from the markdown body
- Structured fields (`tagline`, `hours`) coexist with prose

## Expected route table

- `/` → record composed of `pages/index.json` + `pages/index.md`

## Expected resolved record at `/`

```json
{
  "title": "Reed Bookshop",
  "tagline": "Used books, small shop, since 2003.",
  "hours": { "weekday": "10:00 - 19:00", "weekend": "11:00 - 17:00" },
  "body": "Welcome. We sell used books..."
}
```

## Rules exercised

- Markdown body auto-links to same-slug JSON when JSON has no `body` field
- JSON `title` takes precedence over any H1 in the markdown
- Folder-shape record at `pages/` (i.e. `pages/index.{json,md}`) routes to `/`
