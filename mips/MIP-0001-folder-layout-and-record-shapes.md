# MIP-0001: Folder layout and record shapes

- **Status:** shipped (0.7)
- **Author:** ClearCMS
- **Created:** 2026-05-14
- **Target version:** 0.7

## Summary

Define the top-level folder layout of a Mosaic site and the rules for what constitutes a record.

## Motivation

A spec needs a single, unambiguous answer to "where does X go?" Without it, the same content tree means different things to different engines.

## Specification

A Mosaic site is a directory containing `mosaic.json`, `pages/`, `collections/`, `globals/`, and optionally `images/`. See SPEC.md §2.

A record consists of zero or one markdown file and zero or one JSON file, at least one of which must exist. A record lives either as a direct file/pair in its parent, or as a folder containing `index.md`/`index.json`. See SPEC.md §3.

## Rationale and alternatives

**Why three categories (pages, collections, globals)?**

Considered: one flat `content/` directory with type declared per record. Rejected — routing rules differ fundamentally between pages and records, and singletons need distinct addressing.

**Why allow both direct and folder shapes?**

Considered: folder shape only. Rejected — too heavy for prose-only records. Considered: direct shape only. Rejected — co-located assets are essential for portability.

**Why forbid markdown frontmatter?**

A third place where structured fields could live creates a precedence problem. JSON sidecar is the single authoritative channel.

## Drawbacks

Authors must learn that markdown frontmatter is forbidden, contrary to the convention in most static site generators. Migration tooling can compensate.

## Open questions

None.

## Resolution

Shipped in 0.7.
