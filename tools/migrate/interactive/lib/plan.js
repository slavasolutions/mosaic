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
  plan.site = {
    name: (scan.packageJson && scan.packageJson.name) || "Migrated Site",
    locale: plan.baseLocale ? mapToBcp47(plan.baseLocale) : "en",
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
      const entry = buildCollectionRecordEntry(col.name, slug, group, plan.baseLocale);
      if (entry) plan.collectionEntries.push(entry);
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
// We collapse them into one Mosaic record: pick the base locale's data; carry
// other locales under $astro.translations.<locale>.
function buildCollectionRecordEntry(collectionName, slug, group, baseLocale) {
  // Variant priorities:
  //   1) JSON-only record (.json with no locale) -> data record.
  //   2) Markdown record(s) keyed by locale: pick base, carry others under $astro.
  //   3) Folder record: use index.json + index.md.
  const jsonOnly = group.find((g) => g.shape === "direct" && g.ext === ".json");
  const mdBase = group.find((g) => g.shape === "direct" && (g.ext === ".md" || g.ext === ".mdx") && g.locale === baseLocale);
  const mdAny = group.find((g) => g.shape === "direct" && (g.ext === ".md" || g.ext === ".mdx"));
  const folder = group.find((g) => g.shape === "folder");

  const entry = {
    targetRel: `collections/${collectionName}/${slug}`,
    mode: "create",
    sources: group.map((g) => g.path),
    json: null,
    body: null,
  };

  if (jsonOnly) {
    const data = safeReadJSON(jsonOnly.path) || {};
    const json = normalizeRecordJson(data, baseLocale);
    entry.json = json;
  } else if (mdBase || mdAny) {
    const picked = mdBase || mdAny;
    const parsed = readMarkdownSafe(picked.path) || { frontmatter: {}, body: "" };
    const split = splitFrontmatterToSidecar(parsed.frontmatter, parsed.body);
    entry.json = split.json;
    entry.body = split.body;
    // Carry alternate locales under $astro.translations.
    const others = group.filter((g) => g !== picked && (g.ext === ".md" || g.ext === ".mdx"));
    if (others.length) {
      const translations = {};
      for (const o of others) {
        const op = readMarkdownSafe(o.path) || { frontmatter: {}, body: "" };
        translations[o.locale || "unknown"] = {
          frontmatter: op.frontmatter || {},
          body: op.body || "",
        };
      }
      entry.json["$astro"] = entry.json["$astro"] || {};
      entry.json["$astro"].translations = translations;
    }
  } else if (folder) {
    const ij = path.join(folder.path, "index.json");
    const im = path.join(folder.path, "index.md");
    const data = fs.existsSync(ij) ? safeReadJSON(ij) || {} : {};
    entry.json = normalizeRecordJson(data, baseLocale);
    if (fs.existsSync(im)) {
      try { entry.body = stripFrontmatter(fs.readFileSync(im, "utf8")); } catch {}
    }
  } else {
    return null;
  }

  // Ensure a resolvable title. Title precedence per SPEC §2.3.
  ensureTitleField(entry, slug);
  return entry;
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

// Normalize a JSON record for Mosaic:
//   - localized fields (object keyed by locale) -> keep base-locale value, stash whole object under $astro.
//   - drop `slug` field (it's the filename).
//   - move unknown engine-specific stuff under $astro.
function normalizeRecordJson(raw, baseLocale) {
  const out = {};
  const astro = {};
  const localized = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (k === "slug") { astro.slug = v; continue; }
    if (k === "lang" || k === "locale") { astro[k] = v; continue; }
    if (v && typeof v === "object" && !Array.isArray(v) && isLocaleMap(v)) {
      const base = v[baseLocale];
      out[k] = base !== undefined ? base : (v.en !== undefined ? v.en : Object.values(v)[0]);
      localized[k] = v;
      continue;
    }
    out[k] = v;
  }
  if (Object.keys(localized).length) {
    astro.localized = localized;
  }
  if (Object.keys(astro).length) out["$astro"] = astro;
  return out;
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

module.exports = { buildPlan, inferTypeFields, inferTypeName, lowerSlug, titleCase };
