# Mosaic

**Mosaic is a folder shape for websites.**

Put your content in a folder this way, and any tool that speaks Mosaic can turn it into a website. Different tools, same folder, same site. No database. No lock-in.

## The whole idea, in one picture

```
my-site/
├── mosaic.json        ← "here are my types"
├── pages/             ← one file per page
├── collections/       ← things you have many of (news, team, etc.)
├── globals/           ← site-wide stuff (header, footer)
└── images/            ← pictures
```

That's it. The folder *is* the website.

## Why this exists

Most CMSes lock your content in a database. Most static site generators lock it in a specific framework. Mosaic doesn't lock anything anywhere — your content sits in plain files you can read, edit, and move with any text editor or any AI agent.

If you switch frameworks, your content moves with you. If you want an AI to edit your site, it can read the folder. If you want to peek inside, you open the folder.

## How content works

Every page and every record is one of three things:

- **Just a markdown file** — for pure writing
- **Just a JSON file** — for pure data
- **A markdown file + a JSON file** — writing with extra fields

When you need to keep an image next to a page, make a folder instead of a single file. Same rules apply inside.

## How links between things work

When one piece of content points to another, it uses a **ref**:

```
ref:team/anna           → the team member named anna
ref:globals/site        → the site config
asset:images/logo.svg   → an image
./bio.md                → a file next to this one
ref:team/anna@email     → just anna's email field
```

The `@` part is a **selector** — it picks out one part of the thing.

## How routing works

Pages become URLs. The path is the URL.

```
pages/about.md          → /about
pages/services.json     → /services
```

Collections don't become URLs on their own. A page picks them up by saying "list this collection here":

```json
{ "type": "collection-list", "from": "collections/news" }
```

That page then renders the list *and* creates a URL for each record (`/news/some-story`).

## Status

**Version 0.7 — drafting toward 1.0.** The shape is settling. Breaking changes still possible.

## Where to look next

- **[`examples/hromada-community/`](./examples/hromada-community/)** — a real site you can read end-to-end. Start here.
- **[`spec/SPEC.md`](./spec/SPEC.md)** — the precise rules. For implementers.
- **[`mips/`](./mips/)** — why each rule exists. For people who want to argue.
- **[`tools/`](./tools/)** — the helpers (validate, index, init, infer, migrate, fix).
- **[`tests/`](./tests/)** — the conformance suite. Run these to check a tool.

## License

MIT.
