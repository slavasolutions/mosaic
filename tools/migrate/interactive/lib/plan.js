"use strict";

// Build a migration plan from a scan report.
// Each plan entry is a "decision": what file to write, what action to take.
// Phases match the brief: site identity, pages, collections, messages,
// singletons, assets, redirects, engine-extension preservation.

const fs = require("node:fs");
const path = require("node:path");
const { readMarkdown, splitFrontmatterToSidecar } = require("./markdown");

// Title-case a slug.
function titleCase(slug) {
  return String(slug || "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// Normalize a date-like value (ISO string, JS Date, or human-readable like
// "Jul 08 2022") to YYYY-MM-DD. If parsing fails, return the input unchanged
// (caller may surface drift later). Replaces the older naive slice(0,10)
// that silently corrupted non-ISO strings (the Astro starter blog convention).
function normalizeDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    // Already an ISO date prefix? Fast path.
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
    if (m) return m[1];
    // Try parsing as a JS Date.
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // Unparseable — return the raw value as a string so the validator can
  // surface a type-mismatch instead of silently corrupting.
  return String(v);
}

function lowerSlug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function inferTypeName(collectionName) {
  // events -> Event, news -> NewsItem, team -> TeamMember, etc.
  const map = {
    news: "NewsItem",
    events: "Event",
    team: "TeamMember",
    board: "BoardMember",
    presidents: "President",
    branches: "Branch",
    committees: "Committee",
    galleries: "Gallery",
    newcomers: "NewcomerResource",
    "trillium-awards": "TrilliumAward",
    "trillium-faq": "TrilliumFaq",
    "trillium-recipients": "TrilliumRecipient",
    "trillium-years": "TrilliumYear",
  };
  if (map[collectionName]) return map[collectionName];
  // Singularize and PascalCase.
  let s = collectionName.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase());
  s = s.charAt(0).toUpperCase() + s.slice(1);
  s = s.replace(/ies$/i, "y").replace(/s$/i, "");
  return s;
}

// Build a type definition by sampling records' fields.
// For per-locale records, prefer the base locale's data.
function inferTypeFields(records, baseLocale = "en") {
  const fieldSamples = new Map(); // fieldName -> [values...]
  let sampleCount = 0;
  // Sample post-normalization so the inferred type matches what we actually write.
  // (Localized {en,uk,fr} maps get collapsed to the base-locale scalar.)
  function record(k, v) {
    if (!fieldSamples.has(k)) fieldSamples.set(k, []);
    if (fieldSamples.get(k).length < 8) fieldSamples.get(k).push(v);
  }
  function sampleObject(obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (k === "slug" || k === "lang" || k === "locale") continue;
      if (v && typeof v === "object" && !Array.isArray(v) && isLocaleMap(v)) {
        const base = v[baseLocale];
        record(k, base !== undefined ? base : (v.en !== undefined ? v.en : Object.values(v)[0]));
      } else {
        record(k, v);
      }
    }
  }
  for (const rec of records) {
    if (rec.shape === "direct" && rec.ext === ".json") {
      const data = safeReadJSON(rec.path);
      if (!data || typeof data !== "object") continue;
      sampleCount++;
      sampleObject(data);
    } else if (rec.shape === "direct" && (rec.ext === ".md" || rec.ext === ".mdx")) {
      if (rec.locale && rec.locale !== baseLocale) continue;
      const parsed = readMarkdownSafe(rec.path);
      if (!parsed || !parsed.frontmatter) continue;
      sampleCount++;
      // Mirror the writer's normalization so the inferred type matches output:
      // publishedAt -> date, pubDate -> date, drop lang/locale/slug.
      const fm = Object.assign({}, parsed.frontmatter);
      if (fm.publishedAt && !fm.date) fm.date = normalizeDate(fm.publishedAt);
      if (fm.pubDate && !fm.date) fm.date = normalizeDate(fm.pubDate);
      delete fm.publishedAt; delete fm.pubDate;
      delete fm.slug; delete fm.lang; delete fm.locale;
      sampleObject(fm);
      if (parsed.body && parsed.body.trim()) {
        record("body", "(markdown body)");
      }
    } else if (rec.shape === "folder") {
      const indexJson = path.join(rec.path, "index.json");
      if (fs.existsSync(indexJson)) {
        const data = safeReadJSON(indexJson);
        if (data && typeof data === "object") {
          sampleCount++;
          sampleObject(data);
        }
      }
    }
  }

  // Map field names to Mosaic types. Every observed field becomes part of the
  // type so we don't generate `field.unknown` drift on data we kept verbatim.
  // Fields that travel under $astro.* (engine namespace) are exempt from the
  // unknown-field check per SPEC §8.3.1, so we don't need to declare them.
  const fields = {};
  const skipFromType = new Set(["slug", "lang", "locale"]);

  for (const [k, samples] of fieldSamples.entries()) {
    if (skipFromType.has(k)) continue;
    if (k.startsWith("$")) continue; // engine namespace, never in type
    const fieldType = guessFieldType(k, samples);
    fields[k] = fieldType;
  }
  if (fields.name && !fields.title) {
    // Name is the de-facto title for people records. Surface it under `title` too —
    // but we'll keep the raw `name` field on the record and add a `title` mirror.
  }
  // Make at least one required title field exist.
  if (!fields.title && (fields.name || fields.role)) {
    fields.title = { type: "string", required: true };
  } else if (fields.title) {
    fields.title.required = true;
  } else {
    fields.title = { type: "string", required: true };
  }
  if (fields.date) fields.date.required = true;

  // body field for markdown records.
  if (fieldSamples.has("body")) {
    fields.body = { type: "markdown" };
  }

  return { fields, sampleCount };
}

function guessFieldType(name, samples) {
  // Trust the values first; key-name heuristics second.
  const defined = samples.filter((s) => s !== null && s !== undefined);
  if (defined.length === 0) return { type: "string" };

  // Boolean: every sample is boolean.
  if (defined.every((s) => typeof s === "boolean")) return { type: "boolean" };
  // Number: every sample is number.
  if (defined.every((s) => typeof s === "number")) return { type: "number" };
  // Array: any sample is an array.
  if (defined.some((s) => Array.isArray(s))) return { type: "array", of: "string" };
  // Object: any non-array object sample.
  if (defined.some((s) => s && typeof s === "object" && !Array.isArray(s))) return { type: "object" };

  // Now strings — use key-name hints to refine.
  if (/^(date|year|publishedAt|pubDate)$/i.test(name)) return { type: "date" };
  if (/(image|photo|logo|hero|cover)$/i.test(name)) return { type: "asset" };
  return { type: "string" };
}

function safeReadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function readMarkdownSafe(p) {
  try { return readMarkdown(p); } catch { return null; }
}

// Build the full plan. This is what gets confirmed and written.
function buildPlan(scan, opts = {}) {
  const plan = {
    site: null,
    types: {},
    collections: {},
    singletons: {},
    pageEntries: [],        // [{ targetRel, mode, source, payload }]
    collectionEntries: [],  // [{ targetRel, mode, source, payload, body }]
    singletonEntries: [],   // [{ targetRel, mode, payload }]
    messagesPayload: null,
    messagesPath: null,
    assets: [],             // { absSource, targetRel, size }
    assetsManifest: {},     // { "<targetRel>": { ... } }
    redirects: [],
    documents: [],          // non-image public files we leave at <out>/_astro-public/
    skipped: [],            // { source, reason }
    notes: [],
    locales: scan.messages && scan.messages.locales ? scan.messages.locales : [],
    baseLocale: scan.messages && scan.messages.baseLocale ? scan.messages.baseLocale : "en",
  };

  // ---------- Phase 2: site identity ----------
  // MIP-0014: declare defaultLocale + locales so consumers can iterate
  // across all locales the site ships. We preserve the legacy `locale`
  // field too for round-trip safety (MIP-0009); engines should prefer
  // defaultLocale.
  const allLocales = (plan.locales || []).slice();
  if (plan.baseLocale && !allLocales.includes(plan.baseLocale)) {
    allLocales.unshift(plan.baseLocale);
  }
  const localeTags = allLocales.map((l) => mapToBcp47(l));
  // Keep raw two-letter tags too — many real Astro/inlang setups use them.
  // We emit the BCP-47 form (en-CA, uk-UA) as the canonical site.locales
  // entries to match site.locale + Astro's i18n.locales norms. The migrator
  // also accepts the bare two-letter form on disk and on translatable-field
  // keys for back-compat.
  plan.site = {
    name: (scan.packageJson && scan.packageJson.name) || "Migrated Site",
    locale: plan.baseLocale ? mapToBcp47(plan.baseLocale) : "en",
    defaultLocale: plan.baseLocale ? mapToBcp47(plan.baseLocale) : "en",
    locales: localeTags.length ? localeTags : undefined,
    url: scan.siteUrl || "",
  };

  // ---------- Phase 4: collections + types ----------
  for (const col of scan.contentCollections) {
    const typeName = inferTypeName(col.name);
    const { fields } = inferTypeFields(col.records, plan.baseLocale);
    plan.types[typeName] = { fields };
    plan.collections[col.name] = {
      type: typeName,
      defaultMount: "/" + col.name,
    };
    if (fields.date) plan.collections[col.name].defaultSort = "date desc";
    if (fields.order) plan.collections[col.name].defaultSort = "order asc";

    // Build per-record entries.
    const grouped = groupRecordsByBaseSlug(col.records);
    for (const [baseSlug, group] of grouped.entries()) {
      const slug = lowerSlug(baseSlug);
      if (!slug) {
        plan.skipped.push({ source: baseSlug, reason: "slug empty after normalization" });
        continue;
      }
      // MIP-0014: each baseSlug produces 1..N entries — the canonical
      // record plus one per-locale sibling for every non-default locale
      // that had source content. Older callers expected a single entry;
      // we use buildCollectionRecordEntries for the new path.
      const subEntries = buildCollectionRecordEntries(col.name, slug, group, plan.baseLocale);
      if (subEntries) {
        for (const e of subEntries) plan.collectionEntries.push(e);
      }
    }
  }

  // ---------- Phase 3: pages ----------
  // Most clear-ucc pages are .astro templates — they're not content. We'll
  // mint a `pages/<slug>.json` stub for the routes we can detect, mounting
  // collections with collection-list where it's obvious.
  const stubPages = derivePageStubs(scan, plan);
  plan.pageEntries.push(...stubPages);

  // ---------- Phase 5: messages ----------
  if (scan.messages && scan.messages.locales.length > 0) {
    plan.messagesPath = "messages.json";
    plan.singletons.messages = { type: "Messages" };
    plan.types.Messages = { fields: {} }; // free-form, SPEC §8.3.1
  }

  // ---------- Phase 6: singletons (site, header, footer, meta) ----------
  plan.singletonEntries.push({
    targetRel: "site.json",
    mode: "create",
    payload: {
      name: plan.site.name,
      tagline: "",
      contact: {},
    },
  });
  plan.singletons.site = { type: "SiteConfig" };
  plan.types.SiteConfig = { fields: {
    name: { type: "string", required: true },
    tagline: { type: "string" },
    contact: { type: "object" },
  } };

  // header + footer derived from nav messages keys, if available.
  const headerNav = deriveNavFromMessages(scan, plan);
  if (headerNav.length) {
    plan.singletonEntries.push({
      targetRel: "header.json",
      mode: "create",
      payload: { nav: headerNav },
    });
    plan.singletons.header = { type: "Header" };
    plan.types.Header = { fields: {
      logo: { type: "asset" },
      nav: { type: "array", of: { kind: "object", fields: {
        label: { type: "string", required: true },
        url: { type: "string", required: true },
      } } },
    } };
    plan.singletonEntries.push({
      targetRel: "footer.json",
      mode: "create",
      payload: { copyright: `© ${new Date().getFullYear()} ${plan.site.name}`, links: [] },
    });
    plan.singletons.footer = { type: "Footer" };
    plan.types.Footer = { fields: {
      copyright: { type: "string" },
      links: { type: "array", of: { kind: "object", fields: {
        label: { type: "string", required: true },
        url: { type: "string", required: true },
      } } },
    } };
  }

  // meta.json singleton — SEO defaults. Free-form for now per user note.
  plan.singletonEntries.push({
    targetRel: "meta.json",
    mode: "create",
    payload: {
      defaultTitle: plan.site.name,
      defaultDescription: "",
      ogImage: "",
    },
  });
  plan.singletons.meta = { type: "Meta" };
  plan.types.Meta = { fields: {} };

  // ---------- Phase 7: assets ----------
  for (const pf of scan.publicFiles) {
    if (pf.isImage) {
      const target = "images/" + pf.rel;
      plan.assets.push({ absSource: pf.absPath, targetRel: target, size: pf.size, big: pf.size > 5 * 1024 * 1024 });
      plan.assetsManifest[pf.rel] = {
        mime: mimeFromExt(pf.rel),
        alt: "",
      };
    } else {
      // Non-image — out of Mosaic scope. Park under _astro-public/ for the engine
      // to keep serving from. The leading underscore makes the spec ignore it.
      plan.documents.push({ absSource: pf.absPath, targetRel: "_astro-public/" + pf.rel, size: pf.size });
    }
  }

  // ---------- Phase 8: redirects ----------
  for (const [from, to] of Object.entries(scan.siteRedirects || {})) {
    // Skip dynamic Astro patterns ( [...slug] ); they map at engine level, not Mosaic.
    if (from.includes("[") || to.includes("[")) {
      plan.skipped.push({ source: `redirect ${from} -> ${to}`, reason: "dynamic Astro pattern not supported in Mosaic redirects" });
      continue;
    }
    plan.redirects.push({ from, to, status: 301 });
  }

  // ---------- Resolve page direct-vs-folder collisions ----------
  // If we emit both `pages/<name>.json` AND `pages/<name>/<child>.json`, the
  // validator sees `pages/<name>/` as a folder record (no index.*) and reports
  // a route.collision. Convert the parent direct file to folder shape
  // (`pages/<name>/index.json`) so it cleanly mounts at /<name>.
  collapseDirectFolderConflicts(plan);

  return plan;
}

function collapseDirectFolderConflicts(plan) {
  const dirParents = new Set();
  for (const pe of plan.pageEntries) {
    const m = pe.targetRel.match(/^pages\/(.+)\/[^\/]+\.json$/);
    if (m) dirParents.add(m[1]);
  }
  const rewritten = [];
  const seenTargets = new Set();
  for (const orig of plan.pageEntries) {
    const m = orig.targetRel.match(/^pages\/([^\/]+)\.json$/);
    let pe = orig;
    if (m && dirParents.has(m[1])) {
      pe = Object.assign({}, orig, { targetRel: `pages/${m[1]}/index.json` });
    }
    if (seenTargets.has(pe.targetRel)) continue;
    seenTargets.add(pe.targetRel);
    rewritten.push(pe);
  }
  plan.pageEntries = rewritten;
}

function mapToBcp47(locale) {
  const map = { en: "en-CA", uk: "uk-UA", fr: "fr-CA", de: "de-DE", es: "es-ES" };
  return map[locale] || locale;
}

function mimeFromExt(p) {
  const ext = path.extname(p).toLowerCase();
  return {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif",
    ".svg": "image/svg+xml", ".ico": "image/x-icon",
  }[ext] || "application/octet-stream";
}

function groupRecordsByBaseSlug(records) {
  const map = new Map();
  for (const rec of records) {
    if (!map.has(rec.slug)) map.set(rec.slug, []);
    map.get(rec.slug).push(rec);
  }
  return map;
}

// One slug can have many variants (foo.en.md + foo.uk.md, or foo.json alone).
// MIP-0014: emit them as separate sibling files (`<slug>.<locale>.md`,
// optionally `<slug>.<locale>.json`) instead of collapsing under
// $astro.translations. The base-locale record is the canonical entry the
// type is inferred from; other locales ride along as locale-suffix records.
//
// Returns an array of entries. The first entry is the base-locale record
// (targetRel `collections/<c>/<slug>`); subsequent entries are locale
// variants (targetRel `collections/<c>/<slug>.<locale>`). The shared JSON
// sidecar (if any) lives on the base entry; per-locale JSON overrides land
// on the locale entry only when a per-locale frontmatter field differs from
// the base.
function buildCollectionRecordEntries(collectionName, slug, group, baseLocale) {
  const entries = [];
  const jsonOnly = group.find((g) => g.shape === "direct" && g.ext === ".json" && !g.locale);
  const folder = group.find((g) => g.shape === "folder");
  const mdRecords = group.filter((g) => g.shape === "direct" && (g.ext === ".md" || g.ext === ".mdx"));

  // Case 1: JSON-only data record (no markdown body, no locale variants).
  if (jsonOnly && mdRecords.length === 0 && !folder) {
    const data = safeReadJSON(jsonOnly.path) || {};
    const { base, perLocale } = normalizeRecordJson(data, baseLocale);
    const baseEntry = {
      targetRel: `collections/${collectionName}/${slug}`,
      mode: "create",
      sources: [jsonOnly.path],
      json: base,
      body: null,
      locale: null,
    };
    ensureTitleField(baseEntry, slug);
    entries.push(baseEntry);
    // Emit one per-locale JSON sidecar per non-default locale that has
    // distinct values in the normalized localized maps.
    for (const [loc, fields] of Object.entries(perLocale || {})) {
      if (!fields || Object.keys(fields).length === 0) continue;
      entries.push({
        targetRel: `collections/${collectionName}/${slug}.${loc}`,
        mode: "create",
        sources: [jsonOnly.path],
        json: fields,
        body: null,
        locale: loc,
      });
    }
    return entries;
  }

  // Case 2: Folder-shape record (index.json / index.md inside a slug dir).
  if (folder) {
    const ij = path.join(folder.path, "index.json");
    const im = path.join(folder.path, "index.md");
    const data = fs.existsSync(ij) ? safeReadJSON(ij) || {} : {};
    const { base, perLocale } = normalizeRecordJson(data, baseLocale);
    const baseEntry = {
      targetRel: `collections/${collectionName}/${slug}`,
      mode: "create",
      sources: [folder.path],
      json: base,
      body: null,
      locale: null,
      folder: true,
    };
    if (fs.existsSync(im)) {
      try { baseEntry.body = stripFrontmatter(fs.readFileSync(im, "utf8")); } catch {}
    }
    ensureTitleField(baseEntry, slug);
    entries.push(baseEntry);
    for (const [loc, fields] of Object.entries(perLocale || {})) {
      if (!fields || Object.keys(fields).length === 0) continue;
      entries.push({
        targetRel: `collections/${collectionName}/${slug}.${loc}`,
        mode: "create",
        sources: [folder.path],
        json: fields,
        body: null,
        locale: loc,
        folder: true,
      });
    }
    return entries;
  }

  // Case 3: Markdown record(s) keyed by locale.
  if (mdRecords.length > 0) {
    // Pick the base-locale markdown (or the unlocalized one) as the base
    // record. If neither exists, the first markdown found is the base —
    // we still split locales across siblings.
    const mdBase = mdRecords.find((g) => g.locale === baseLocale) ||
                   mdRecords.find((g) => g.locale === null) ||
                   mdRecords[0];
    const baseParsed = readMarkdownSafe(mdBase.path) || { frontmatter: {}, body: "" };
    const baseSplit = splitFrontmatterToSidecar(baseParsed.frontmatter, baseParsed.body);
    const baseEntry = {
      targetRel: `collections/${collectionName}/${slug}`,
      mode: "create",
      sources: [mdBase.path],
      json: baseSplit.json,
      body: baseSplit.body,
      locale: null,
    };
    ensureTitleField(baseEntry, slug);
    entries.push(baseEntry);

    // For every other markdown, emit a `<slug>.<locale>.md` sibling.
    // Frontmatter fields that match the base are dropped from the locale
    // JSON sidecar; fields that differ become the per-locale override.
    for (const o of mdRecords) {
      if (o === mdBase) continue;
      if (!o.locale) continue; // skip orphan unlocalized siblings
      const op = readMarkdownSafe(o.path) || { frontmatter: {}, body: "" };
      const osplit = splitFrontmatterToSidecar(op.frontmatter, op.body);
      const overrides = diffFields(osplit.json, baseSplit.json);
      const locEntry = {
        targetRel: `collections/${collectionName}/${slug}.${o.locale}`,
        mode: "create",
        sources: [o.path],
        json: Object.keys(overrides).length ? overrides : null,
        body: osplit.body,
        locale: o.locale,
      };
      entries.push(locEntry);
    }
    return entries;
  }

  return null;
}

// Compute the per-locale override JSON: keep keys whose value differs from
// the base record. Engine-namespaced ($astro.*) keys always survive on the
// locale record so MIP-0009 round-trip holds.
function diffFields(localeJson, baseJson) {
  const out = {};
  for (const [k, v] of Object.entries(localeJson || {})) {
    if (k.startsWith("$")) {
      // Always carry engine extras on the locale entry — they were
      // observed on this locale's source file.
      out[k] = v;
      continue;
    }
    const bv = baseJson ? baseJson[k] : undefined;
    if (!deepEqual(bv, v)) out[k] = v;
  }
  return out;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a); const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

// Legacy single-entry shim. Some downstream callers (tests, debugging
// scripts) still expect the singular form. Keep it as a thin wrapper.
function buildCollectionRecordEntry(collectionName, slug, group, baseLocale) {
  const all = buildCollectionRecordEntries(collectionName, slug, group, baseLocale);
  return all && all.length ? all[0] : null;
}

function stripFrontmatter(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== "---") return raw;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") { end = i; break; }
  }
  if (end === -1) return raw;
  const body = lines.slice(end + 1);
  while (body.length && body[0].trim() === "") body.shift();
  return body.join("\n");
}

function ensureTitleField(entry, slug) {
  if (!entry.json) entry.json = {};
  if (entry.json.title && typeof entry.json.title === "string" && entry.json.title.trim()) return;
  if (entry.json.title && typeof entry.json.title === "object") {
    // Localized title — surface the base-locale value as `title`, stash whole object under $astro.
    const localized = entry.json.title;
    const flat = localized.en || localized.uk || localized.fr || Object.values(localized)[0];
    entry.json["$astro"] = entry.json["$astro"] || {};
    entry.json["$astro"].titleLocalized = localized;
    entry.json.title = typeof flat === "string" ? flat : titleCase(slug);
    return;
  }
  if (typeof entry.json.name === "string" && entry.json.name.trim()) {
    entry.json.title = entry.json.name;
    return;
  }
  // Markdown H1 in body satisfies required-title (SPEC §2.3); skip if body has H1.
  if (entry.body && /^\s*#\s+\S/.test(entry.body)) return;
  entry.json.title = titleCase(slug);
}

// Normalize a JSON record for Mosaic.
//
// MIP-0014: localized fields (`{ en: "X", uk: "Y" }`) split into a
// base-locale value on the canonical record + a per-locale override
// object on each non-default-locale sibling.
//
// Returns `{ base, perLocale }`:
//   - base      → JSON to write at `<slug>.json` (the canonical record).
//   - perLocale → `{ "<locale>": { <overridden fields> }, ... }` for each
//                 non-default locale that had any divergent value. The
//                 caller emits these as `<slug>.<locale>.json` sidecars.
//
// Notes:
//   - `slug` and `lang`/`locale` engine bookkeeping still survives under
//     `$astro` so MIP-0009 round-trip holds.
//   - The localized field is also stamped on $astro.localized to preserve
//     the original shape for engines that still want it (clear-ucc was
//     reading from there). New consumers should prefer the
//     locale-suffix sibling records.
function normalizeRecordJson(raw, baseLocale) {
  const base = {};
  const astro = {};
  const localized = {};
  const perLocale = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (k === "slug") { astro.slug = v; continue; }
    if (k === "lang" || k === "locale") { astro[k] = v; continue; }
    if (v && typeof v === "object" && !Array.isArray(v) && isLocaleMap(v)) {
      // Split locale map: keep base-locale value on the canonical record,
      // emit other locales' values onto per-locale sidecars.
      const baseVal = v[baseLocale] !== undefined ? v[baseLocale] : (v.en !== undefined ? v.en : Object.values(v)[0]);
      base[k] = baseVal;
      localized[k] = v;
      for (const [loc, val] of Object.entries(v)) {
        if (loc === baseLocale) continue;
        if (val === undefined || val === null) continue;
        if (deepEqual(val, baseVal)) continue;
        perLocale[loc] = perLocale[loc] || {};
        perLocale[loc][k] = val;
      }
      continue;
    }
    base[k] = v;
  }
  if (Object.keys(localized).length) {
    astro.localized = localized;
  }
  if (Object.keys(astro).length) base["$astro"] = astro;
  return { base, perLocale };
}

function isLocaleMap(obj) {
  const keys = Object.keys(obj);
  if (keys.length === 0 || keys.length > 6) return false;
  return keys.every((k) => /^[a-z]{2}(-[A-Z]{2})?$/.test(k));
}

function derivePageStubs(scan, plan) {
  const pages = [];

  // Always emit a homepage stub.
  pages.push({
    targetRel: "pages/index.json",
    mode: "create",
    payload: {
      title: plan.site.name,
      sections: [],
    },
    notes: ["home page — sections empty; Astro template logic not migrated"],
  });

  // For each .astro page (excluding api/, dynamic locale prefixes), mint a page stub
  // that mentions the collection it likely belongs to.
  const seenSlugs = new Set();
  for (const p of scan.pages) {
    if (p.isApi || p.isXml || p.kind !== "astro") continue;
    if (p.relUnix.startsWith("api/")) continue;

    // Strip [...locale]/ prefix.
    let rel = p.relUnix.replace(/^\[\.\.\.locale\]\//, "");
    // Skip 404 and dev brand-palette and bracketed dynamic routes.
    if (rel === "404.astro" || rel.startsWith("dev/")) continue;
    if (/\[/.test(rel)) {
      // Dynamic detail route: e.g. events/[slug].astro -> the page that mounts it.
      const parent = rel.split("/")[0];
      if (parent && !seenSlugs.has(parent) && plan.collections[parent]) {
        seenSlugs.add(parent);
        pages.push(makeCollectionListPage(parent));
      }
      continue;
    }
    // Strip extension.
    rel = rel.replace(/\.astro$/, "");
    if (rel === "index") continue;

    const segments = rel.split("/");
    const slug = lowerSlug(segments[segments.length - 1]);
    if (!slug) continue;
    if (seenSlugs.has(rel)) continue;
    seenSlugs.add(rel);

    // If the slug matches a collection, mount it with collection-list.
    if (segments.length === 1 && plan.collections[slug]) {
      pages.push(makeCollectionListPage(slug));
      continue;
    }

    // Otherwise emit a placeholder page.
    pages.push({
      targetRel: `pages/${rel}.json`,
      mode: "create",
      payload: {
        title: titleCase(slug),
        sections: [],
        "$astro": { source: `src/pages/[...locale]/${rel}.astro` },
      },
      notes: ["template-only page; Astro logic preserved under $astro.source"],
    });
  }

  return pages;
}

function makeCollectionListPage(collectionName) {
  return {
    targetRel: `pages/${collectionName}.json`,
    mode: "create",
    payload: {
      title: titleCase(collectionName),
      sections: [
        {
          type: "collection-list",
          from: `collections/${collectionName}`,
        },
      ],
    },
    notes: [`mounts collection ${collectionName}`],
  };
}

function deriveNavFromMessages(scan, plan) {
  const baseLocale = plan.baseLocale || "en";
  if (!scan.messages || !scan.messages.files[baseLocale]) return [];
  let raw;
  try { raw = JSON.parse(fs.readFileSync(scan.messages.files[baseLocale], "utf8")); }
  catch { return []; }

  // Pick keys with nav_<key> pattern; map to /<key> URLs where plausible.
  const items = [];
  const urlGuess = (k) => {
    const map = {
      home: "/", about: "/about", mandate: "/about/mandate-objectives",
      branches: "/about/members", board: "/about/board-of-directors",
      volunteer: "/volunteer", become_member: "/about/members",
      news: "/news", events: "/events", trillium: "/trillium-award",
      initiatives: "/get-involved", newcomers: "/newcomers",
      contact: "/contact", donate: "/support",
    };
    return map[k] || "/" + k.replace(/_/g, "-");
  };
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith("nav_")) continue;
    if (k === "nav_toggle") continue;
    const tail = k.slice(4);
    items.push({ label: typeof v === "string" ? v : String(v), url: urlGuess(tail) });
  }
  return items;
}

module.exports = { buildPlan, buildCollectionRecordEntries, inferTypeFields, inferTypeName, lowerSlug, titleCase };
