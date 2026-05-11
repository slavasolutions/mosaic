# minimal-site

The smallest meaningful Mosaic document.

- One page (`/`)
- Two block types (`heading`, `paragraph`)
- No collections, no assets, no i18n

This example demonstrates the smallest valid `mosaic.json` that has actual content on disk. For the absolute smallest valid Mosaic document (no content at all), see `spec.md` §3.1.

## File tree

```
minimal-site/
├─ mosaic.json
└─ content/
   └─ pages/
      └─ index.json
```

## Reading this example

A conforming reader should:

1. Parse `mosaic.json` and validate it against `spec.md` §4.
2. Walk `content/pages/` and validate each page record against §5.
3. For each section, validate the slot values against the declared block type.
4. Produce whatever output the reader produces (HTML, JSON, native UI, etc.).

There is no rendered output in this directory. Rendering is the reader's job.
