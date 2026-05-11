# Editor / CMS interface research — first principles for Clear Studio

Status: research input for Studio v3 wireframe. Not a spec.
Audience: founder + future implementers.
Frame: distill principles, mine prior art, pick a layout, diff against v2.

The Clear thesis: "a site is a document." The Studio must feel like editing a structured living document under typed constraints — not administering rows in a database, not painting on a free canvas. Two surfaces (form-fill, visual canvas), two modes (Content, Design), one schema as ground truth.

---

## 1. First principles

Load-bearing rules for any structured-content editor. Each implies something concrete for Clear.

**1. Direct manipulation beats indirect command.**
Editing happens on the thing, not in a modal about the thing. Clicking a headline edits the headline; clicking a hero picks a hero. Implication for Clear: text slots edit in place, never in a side-panel mirror; the right pane shows context and structure, not the primary input surface.

**2. Latency is the only feature.**
Sub-100ms response per keystroke or the editor feels like a database admin tool. Implication for Clear: CRDT-first means local-first; never block on a server round-trip for typing, dropdowns, or reorder. Server is for sync, not for redraw.

**3. The schema should be felt, not seen.**
Constraints guide hands without lecturing eyes. A slot that takes only `assetRef` shouldn't display a Type dropdown; the affordance is "drop an image here." Implication for Clear: the block algorithm shapes affordances (inputs render to type), not annotations ("type: assetRef" labels). Validators surface errors at the input, not in a separate panel.

**4. Progressive disclosure beats hidden depth.**
80% of edits one click away, 20% two, 0% buried in a tree. Implication for Clear: slot inputs always inline; variant + token swaps one click in the inspector; block algorithm two clicks in Design mode; raw JSON never on the default path.

**5. One canonical view, many lenses.**
The doc is one thing. Form, canvas, JSON, outline are all projections. Switching lens must preserve selection + scroll. Implication for Clear: section ID = URL fragment, persists across surface toggle. Form-fill and visual canvas share selection state via the LoroDoc, not via local UI state.

**6. Keyboard is the power-user contract.**
Every navigable thing has a key. Slash, command palette, `/`, `j/k`, `Cmd-Enter`, `Esc`. Implication for Clear: command palette (`Cmd-K`) is non-negotiable from MVP; slash-menu inside text slots to insert blocks (Notion / Tiptap pattern); `j/k` between sections; `Esc` to deselect.

**7. Selection is the primary noun.**
What's selected determines what's possible. The whole UI re-skins around it. Implication for Clear: one always-true selection scope (page / section / slot). Inspector, command palette, breadcrumbs all read from it. No mode-without-selection.

**8. Boring beats clever for daily work.**
Editors aren't where you delight; they're where you don't get in the way. Implication for Clear: low-saturation chrome, generous whitespace, type as the primary visual element. No animated transitions on the editing path. Animations only for state changes humans need to perceive (publish success, conflict).

**9. The structure should be navigable as a list.**
Long documents need a spine. Outline view, fold/expand, jump-by-number. Implication for Clear: sections numbered (Notion-style anchor numbers), foldable, drag-by-handle, jump via `Cmd-K → section N`. The page tree on the left is the inter-page spine; the section list in the center is the intra-page spine.

**10. State must be legible without effort.**
What's saved, what's dirty, what's published, what's translated. All readable at a glance, never hidden in a menu. Implication for Clear: status chips inline (draft, missing FR, validation error), persistent "autosaved · published 14:32 by SL" footer, never a "save" button.

---

## 2. Lessons from prior art

Six comparators, each scored: strong / fails / steal-for-Clear.

**Notion / Coda.**
Strong: block model with slash menu, drag-rail on hover, type-coercion (paste URL → embed), one canonical column. Fails: long pages turn into infinite scroll with no spine; nested DBs become "where did I put that?"; cross-page refactor is painful. Steal: slash menu inside text slots, hover-rail drag handle on every section, sub-100ms keystrokes as a religious commitment.

**Figma.**
Strong: canvas + right-properties-panel; selection-driven UI; component instances vs main components; bottomless undo; multiplayer presence cursors. Fails: not document-shaped — long-form text is hostile; structural-only edits (reorder, reparent) require canvas zooming; no schema enforcement. Steal: right-panel "properties of selection" pattern; presence cursors (Clear has CRDT collab — show it); Cmd-K jump-to-anywhere; component-instance metaphor maps onto Clear's collection references.

**Webflow Designer.**
Strong: explicit Editor/Designer mode toggle (maps 1:1 to Clear Content/Design); style panel with token references; visual hierarchy via outliner. Fails: properties panel is so dense it requires training; nested divs in the outliner — too many structural primitives leaks the DOM; Editor mode is a stripped-down rerun rather than a different surface. Steal: the mode-toggle pattern (Clear already has it); the outliner as a structural pane; the "tokens are first-class, hard-codes are flagged" discipline.

**Sanity Studio / Contentful.**
Strong: schema-driven forms, validation per field, references with previews, side-by-side translation view, structure builder. Fails: end up as form-walls — visually flat, every field equally weighted, no sense of the document; preview is an afterthought; canvas missing. Steal: validation surfaces at the input (green check, red underline), reference picker with preview card, side-by-side locale view (translators need this), structure builder lets the customer rearrange how the admin reads.

**Payload.**
Strong: drop-in admin, schema-first, blocks field type already shipped; sensible defaults; good information density without feeling cramped. Fails: still form-shaped; blocks field is a list of nested forms, no document feel; lacks visual canvas (Figma's June 2025 acquisition might fix this). Steal: schema-as-truth, drop-in installation pattern, restraint with chrome.

**BlockSuite (AFFiNE).**
Strong: block-based, schema-driven, multi-mode (doc / whiteboard / database) under one engine, Yjs-native (Loro-portable in principle), MIT-licensed. Fails: relatively young, ecosystem thinner than Tiptap/Lexical, mode-switching is heavy to set up. Steal: this is the candidate per clear-decisions §10 — build Clear's canvas + form on top of BlockSuite primitives rather than from scratch; multi-mode-on-one-engine is exactly Clear's surface story.

**Tiptap / Lexical / ProseMirror.**
Strong: industry-standard rich-text inside a slot; collaborative; extensible. Fails: text-only — no block-of-blocks structure outside text. Steal: use Tiptap inside richtext slots only (§10 already says this); don't try to make it the outer container.

**Linear.**
Strong: command palette as primary nav (`Cmd-K` does ~80% of UI), keyboard-driven, snappy, opinionated. Fails: doc-shape weak — fine for issues, would crack for a long edited document. Steal: command palette pattern, the "every action has a shortcut and the shortcut is shown" discipline, the latency obsession.

**Notion AI / Frame.io / Loom comments.**
Strong: AI suggestions inline with accept/reject; comments pinned to specific selection; presence indicators. Steal: AI translation as inline accept/reject (Clear has this as a M3-M6 feature); comments anchored to section ID; presence cursors anchored to selection.

---

## 3. Space-utilization patterns

Five layouts and when each earns its space.

**A. Three-pane (left nav / center doc / right inspector).**
Works when navigation, content, and properties are all dense enough to need permanent real estate. Fails at narrow widths and on long documents (right pane shows the same fields whether you're scrolled to section 1 or section 9). Use for: Clear Studio default desktop, but make the right pane selection-following.

**B. Two-pane with floating inspector (Figma).**
Center is the canvas; left is layers/pages; right pane is the property of selection, including text fields. Works when the canvas is the primary editing surface. Fails for long-form text — you end up editing text in a side panel. Use for: Clear visual canvas (M4b), not for form-fill.

**C. Single-pane document with side-rail toggles (Notion).**
The doc is the main thing; nav and inspector slide in on demand. Works for long, linear content where most edits are inline. Fails when you need to compare structure to detail simultaneously (translator workflow). Use for: focus mode / mobile.

**D. Canvas with overlaid floating panels (Webflow, Figma Sites).**
Maximum canvas real estate, panels float over. Works when pixel-true rendering matters more than density of structured input. Fails for form-heavy work — floating panels obscure the thing you're editing. Use for: Clear visual canvas in fullscreen / present mode, not default.

**E. Outliner mode (Workflowy, Tana).**
Pure tree. Indent / outdent / fold. Works for restructuring at speed (reordering ten sections takes seconds). Fails for detail editing. Use for: a dedicated Clear "structure" view that's one keystroke away (`Cmd-O`), not the default.

**F. Command palette as primary interaction (Linear, Raycast).**
The palette is the input; the UI is the output. Works when the action space is large and well-named. Fails when actions are spatially anchored (drag-reorder a section beats `Cmd-K → move section 3 down`). Use for: Clear, alongside everything else — `Cmd-K` ubiquitous, never the only path.

**G. Slash menu in body (Notion, Tiptap).**
`/` opens an inline menu of inserts. Works for text-flow insertion. Fails when the structure is rigid (Clear sections aren't a free flow — they're a typed list). Use for: inside richtext slots only; for section-level insertion use a hover-rail "insert" button between sections plus `Cmd-K`.

**Recommended primary layout for Clear:** three-pane with three behaviors layered on top —
1. The center pane is **document-shaped, not form-stack-shaped** (Notion-grade typography, no card chrome, sections numbered and foldable).
2. The right pane **follows selection** (Figma-grade). When nothing selected, it shows page-level meta. When a section is open, section meta + variant + translation status. When a slot is focused, slot-specific helpers (asset picker preview, reference preview).
3. The whole thing is **command-palette-traversable** (Linear-grade). Every nav target, every action, every section has a hotkey path.

---

## 4. Recommendation for Clear Studio v3

**Shape.**
Three-pane on desktop; the center pane is a document, not a form stack. Left pane: pages + collections (tree, persistent). Center: page-as-document — title as H1, sections as numbered, foldable items in a single column, each section opens inline (in-place, no modal). Right pane: selection-aware inspector that re-skins entirely depending on whether nothing / section / slot is selected. Mobile collapses to single-pane with the left pane as a drawer.

The "document feel" comes from typography and spacing, not from removing structure. Sections are not cards. They're numbered items in a list, like markdown headings with content underneath. Open one → its slots render as labeled fields with bottom-rule inputs (already in v2 — keep this). Close it → it collapses to a one-line preview ("2 hero — 'A site is a document.'"). The page reads top to bottom like an outline of the rendered site.

**MVP interaction patterns (must have at M4a).**

1. **Command palette (`Cmd-K`).** Jumps to any page, section, slot, action, mode, locale. Search by label or by section number.
2. **Slash menu inside richtext slots.** Tiptap-driven; inserts only inline marks (bold, link, code), not blocks (blocks are section-level).
3. **Inline insert between sections.** Hover-rail between any two sections shows `+ insert section` → opens a typed picker (only declared block types). Same picker as `Cmd-K → new section`.
4. **Selection-following inspector.** Right pane reads from the current selection (page / section / slot) via shared state. Never shows stale fields.
5. **Mode toggle as scope gate, not surface gate.** Content mode disables structural affordances (no insert rail, no reorder handles, no Design nav items), keeps slot edits. Already in v2 — keep.

**Anti-patterns to refuse (with comparator that proves the lesson).**

1. **No card chrome on sections.** (Lesson: Sanity / Contentful — cards make every section equally weighted, kill the document feel.)
2. **No modal forms for slot edit.** (Lesson: WordPress Gutenberg block settings modals — break flow, break selection, break undo scoping.)
3. **No nested div outliner.** (Lesson: Webflow — leaking the DOM into the outliner forces non-designers to learn flexbox to move a hero up.)
4. **No floating panels by default.** (Lesson: Figma in long-form contexts — panels cover the thing you're editing.)
5. **No "save" button.** (Lesson: Notion / Linear — autosave + version history is the only acceptable model in a CRDT-backed editor.)

**A note on the visual canvas (M4b).** Per §10, form-fill ships first. The form-fill surface described above is the M4a target. M4b adds the visual canvas as a *second surface* (iframe of real site + click-to-edit hotspots — Sanity Visual Editing / Storyblok pattern). The two surfaces share selection. The mode toggle (Content / Design) and the surface toggle (Form / Canvas) are orthogonal — two buttons, not nested menus.

---

## 5. v3 wireframe diff (against current v2)

**Add.**
- **Command palette (`Cmd-K`).** Top-bar icon; modal overlay with fuzzy search across pages, sections, actions. Single most-impactful addition.
- **Section number affordance.** Make the numbers in front of each section row clickable as anchors (URL fragment `#sec-2`) and droppable as reorder handles. Number + handle merge into one element.
- **Hover insert-rail between sections.** Thin spacer between sections becomes `+` on hover (Design mode only).
- **Selection-aware right pane.** When the focused element is a slot, the inspector shows slot-specific helpers (asset preview, reference card). When nothing focused, page meta.
- **Slash menu inside richtext slots.** `/` triggers Tiptap-driven inline insertion menu.
- **Outline mode (`Cmd-O`).** Collapses every section to its one-line preview row, plus indentation for sub-blocks (e.g. pillars under pillarGrid). Drag to reorder, `j/k` to navigate, `Enter` to open. One keystroke back to default view.
- **Presence dots.** Even if collab isn't wired yet, ship the visual slot — bottom-right cluster of editor avatars. Demoable signal of CRDT collab story.
- **Surface toggle stub.** Add a "Form · Canvas" toggle next to "Content · Design" in the top bar, disabled with a "M4b" tooltip. Sets the architecture expectation now.

**Remove / shrink.**
- **Cut the "Section / Type / Status" repetition in the right inspector.** Section ID + type are already in the row; Status is visible as a chip. Inspector should lead with what's *actionable per selection*, not echo what's on screen.
- **Cut the "Validation" panel as a separate block.** Validation surfaces at the input itself (red bottom-rule, inline message). The right-pane Validation section becomes a single line: "1 issue ↓" that scrolls to the offending slot when clicked.
- **Cut the "Translation" panel from the section inspector.** Translation status belongs page-level (top bar locale switcher + per-page translation indicator in left nav). At section level it's noise — translators care about the whole-page locale, not section-by-section.
- **Drop "section type" as a visible label per row.** Replace with an icon for the block type + the preview text. The type name is dev-speak; agencies and content editors don't need "pillarGrid" in their face. Show it in the inspector and on hover.
- **Trim the "more" menu.** Locale, branch, history, translate, visual canvas, preview, JSON, shortcuts — eight items is a settings page in disguise. Locale moves to a top-bar pill; branch + history move into the command palette; JSON moves to a dev-mode toggle; shortcuts triggered by `?`. The "more" menu shrinks to: History, Preview, Settings.

**Restructure.**
- **Page title row becomes minimal H1 only.** Strip the metadata strip ("/", "Published 14:32", "layout: default"). Move all that to a single line in the right pane under "Page" when the page is the selection. The document opens with: title, then sections, nothing else.
- **Left pane reorders.** Pages first (already done), Collections second, Blog third (or fold Blog under Pages as a sub-tree — blog posts are pages). The "Design" section in the left pane stays Design-mode-only; add a "Settings" leaf for site-level config.
- **Move "+ Insert section" out of the doc footer.** Inline hover rail handles it. Footer becomes pure metadata ("autosaved · published 14:32 by SL").
- **Inspector becomes context-stack.** Top of the right pane: breadcrumb of selection (`Home › section 2: hero › Headline`). Below: properties of the most-specific selection. This makes the inspector legible at any selection depth.

**Don't touch.**
- Mode toggle (Content / Design) is right where it should be.
- Field-input pattern (transparent border, bottom rule, focus accent) is correct — keep.
- Section row → inline open is the right interaction. Don't replace with modal.
- Doc footer metadata strip is correct in spirit; just trim it to autosave + publish state.

---

## Closing

The v2 wireframe is a *good form-fill admin*. The v3 wireframe should be a *good edited document that happens to be form-fill underneath*. The difference is: v3 reads top-to-bottom like the rendered page's outline, every interaction is anchored to selection, and the keyboard can drive everything. Visual canvas (M4b) is a second surface over the same data — not a different product.

The biggest single lever: command palette + selection-following inspector + outline mode. Those three changes turn the v2 form-stack into a navigable document.
