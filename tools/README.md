# tools/

Small, format-only dev utilities for inspecting Mosaic documents. **Tools live here, engines live elsewhere.**

## Scope

What belongs in this directory:

- **Format inspection.** Tools that read a Mosaic document and show what's in it (block types, slots, refs, tokens, collections, i18n) — without rendering it as a website.
- **Format validation.** Tools that check whether a `mosaic.json` (and optionally its content tree) conforms to the spec. Schema-shape, cross-reference, cross-field.
- **Format conversion.** Tools that transform between Mosaic-compliant representations (e.g. single-file → file-tree, JSON5 → JSON).
- **Format diffing.** Tools that compare two Mosaic documents and report breaking-vs-additive changes per §9.

What does **NOT** belong here:

- **Renderers.** Anything that turns a Mosaic document into HTML, PDF, native UI, or pixel output is engine territory. See `README.md` Implementations table.
- **Editors.** Anything that mutates a document via UI. Engines own the authoring surface.
- **Storage.** Persistence, CRDT runtimes, sync protocols. Engine territory.
- **Site generators.** "Static site from Mosaic" is a renderer (above) + a build pipeline. Belongs in an engine repo.

If you're tempted to add a rendering or editing tool here, ask: would a weekend implementer building their own engine consider this prior art or competition? If competition, it belongs in its own repo. The spec repo stays format-only per `AGENTS.md` rule #1.

## What's here

| Tool | Purpose | Run |
| --- | --- | --- |
| `viewer.html` | Drag-drop a `mosaic.json` into a single HTML file. See structure (block types, slots, variants, tokens, collections, i18n). No render. | Open in any browser. Zero install. |

## Companion projects (not in this repo)

- **`@slavasolutions/mosaic-preview`** *(planned)* — AI-facing wireframe renderer. Takes a Mosaic doc, emits structural wireframe HTML for AI clients to display inline. Includes "Open in Clear →" handoff CTA. Lives in its own repo. **Deliberately wireframe-aesthetic** — does not compete with engine-level renderers; visibly incomplete to make the handoff CTA compelling.

- **Clear Playground** *(planned)* — interactive demo of editing a Mosaic site with Clear's full render + form + AI surfaces. Lives in `clearcms/clear` (the reference engine). Reuses `@clear/render`, `@clear/schema`, Loro.

The spec repo links these from its README implementations table when they exist; it does not host them.

## Adding a tool

PRs welcome. Constraints:

1. **One file per tool when possible.** Single-file HTML for browser tools; single `.mjs` for Node tools. No build steps. No bundlers.
2. **Zero or near-zero dependencies.** Browser tools: vanilla HTML/CSS/JS, or one CDN import for an established library (e.g. ajv). Node tools: built-ins only, or one dep maximum.
3. **Document the scope at the top of the file.** What it does, what it does NOT do.
4. **Reference the spec by section.** When validating or inspecting, cite the relevant `spec.md` section so users can trace back to authority.
5. **No telemetry, no network calls** except to load referenced documents the user pointed at.

If a tool requires more than one file or any dep beyond the above, it probably belongs in its own repo as a separate package.
