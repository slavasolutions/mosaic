# blog-site

A small blog with two posts. Demonstrates:

- A `blog` collection with `urlPattern` and records-on-path layout
- The `ref:` reference shape (home page links to two blog records)
- Inline-body posts and markdown-body posts (the second post's body is an `asset:content/...md` reference)
- Multiple block types with variants

## File tree

```
blog-site/
├─ mosaic.json
└─ content/
   ├─ pages/
   │  └─ index.json
   └─ blog/
      ├─ first-post.json
      └─ second-post.json
```

## What's worth noticing

The home page's `postList` section references blog records by `ref:blog/<id>`. The reader is responsible for resolving those refs and producing output (a list of cards, an RSS feed, a JSON API response — whatever the reader does).

The `blog` collection declares `urlPattern: "/blog/{slug}"`. A reader producing URL-addressable pages should generate `/blog/first-post` and `/blog/second-post` from the collection records. This is reader behavior, not format behavior — the spec only declares the pattern; the reader implements the URL routing.

The second post's `body` is `"asset:content/blog/second-post.md"`. Per `spec.md` §7.3, when a `.md` extension is detected on a resolved asset, readers SHOULD inline the body as CommonMark + GFM. (The actual `.md` file isn't included here because this is a format example; in a real implementation the file would exist alongside `second-post.json`.)
