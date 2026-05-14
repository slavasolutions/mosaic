// load-site.js
//
// Astro Content Collection loader's site reader. Delegates to @mosaic/core
// for the walk → routes → refs pipeline and then projects core's site shape
// into the astro-loader's expected output (pre-rendered bodyHtml, locale
// views in `localized`, ref stubs in record JSON, etc.).
//
// The marked-based markdown HTML renderer stays in this file because @mosaic/core
// has zero runtime deps and the astro adapter genuinely needs HTML output.

import path from "node:path";
import { marked } from "marked";

import {
  loadSite as coreLoadSite,
  looksLikeRef,
  parseRef,
} from "../../core/src/index.js";

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export async function loadSite(siteDir) {
  const sitePath = path.resolve(siteDir);
  const core = coreLoadSite(sitePath);

  // Walk every record's JSON and replace ref-looking strings with stubs.
  // Core surfaces diagnostics for unresolved refs but doesn't mutate the data.
  // The astro-loader has historically returned data with refs already
  // replaced (so Zod schemas can look at $ref/$asset shapes), so we do the
  // mutation here.
  inlineRefStubs(core);

  // Compute per-locale views with pre-rendered HTML for record bodies and
  // attach to each record as `.localized[<locale>] = { data, body, bodyHtml, title }`.
  attachLocalizedViews(core);

  const finalized = finalize(core);
  return finalized;
}

function inlineRefStubs(site) {
  for (const rec of site.allRecords) {
    if (!rec.json) continue;
    rec.json = walkAndReplace(rec.json, (val) => buildStubFor(val, site, rec));
    rec.data = rec.json;
    // Update localized data the same way.
    if (rec.localized) {
      for (const [, view] of Object.entries(rec.localized)) {
        view.data = walkAndReplace(view.data, (val) => buildStubFor(val, site, rec));
      }
    }
  }
}

function walkAndReplace(node, fn) {
  if (Array.isArray(node)) {
    return node.map((v) => walkAndReplace(v, fn));
  }
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node)) out[k] = walkAndReplace(node[k], fn);
    return out;
  }
  if (typeof node === "string") {
    const replaced = fn(node);
    if (replaced !== undefined) return replaced;
  }
  return node;
}

function buildStubFor(value, site, hostRec) {
  if (typeof value !== "string" || !looksLikeRef(value)) return undefined;
  const parsed = parseRef(value);
  if (!parsed.ok) return undefined;

  if (parsed.kind === "asset") {
    let rel = parsed.path;
    if (rel.startsWith("images/")) rel = rel.slice("images/".length);
    const meta = (site.assetManifest && site.assetManifest[rel]) || {};
    return { $asset: "images/" + rel, ...meta };
  }
  if (parsed.kind === "relative") {
    let pathStr = parsed.path;
    if (hostRec && hostRec.dataDir) pathStr = `${hostRec.dataDir}/${parsed.path}`;
    return { $rel: "./" + parsed.path, path: pathStr };
  }
  // ref:
  if (parsed.singleton) {
    const s = site.singletonsByName.get(parsed.singleton);
    const stub = {
      $ref: parsed.address,
      url: null,
      title: s ? (s.title || s.slug) : parsed.singleton,
    };
    if (parsed.selector) stub.selector = parsed.selector;
    return stub;
  }
  const coll = site.collectionsByName.get(parsed.collection);
  const rec = coll ? coll.recordsBySlug.get(parsed.slug.toLowerCase()) : null;
  return {
    $ref: parsed.address,
    url: rec ? (site.recordUrls.get(rec) || rec.url || null) : null,
    title: rec ? (rec.title || rec.slug) : parsed.slug,
    ...(parsed.selector ? { selector: parsed.selector } : {}),
  };
}

function attachLocalizedViews(site) {
  for (const rec of site.allRecords) {
    // Pre-render markdown bodies as HTML for the astro adapter.
    rec.bodyHtml = rec.body ? renderMarkdown(rec.body) : "";
    if (rec.localized) {
      for (const [, view] of Object.entries(rec.localized)) {
        view.bodyHtml = view.body ? renderMarkdown(view.body) : "";
      }
    }
  }
}

function renderMarkdown(md) {
  try {
    return marked.parse(md, { mangle: false, headerIds: true });
  } catch {
    return `<pre>${escapeHtml(md)}</pre>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Strip internal pointers + reshape to the public adapter contract.
function finalize(site) {
  const stripInternal = (rec) => {
    if (!rec) return rec;
    const { here, _url, _pathSegments, localeFiles, ...rest } = rec;
    return rest;
  };

  const pages = {};
  for (const p of site.pages) pages[p.url] = stripInternal(p);

  const collections = {};
  for (const [name, coll] of site.collectionsByName.entries()) {
    const records = {};
    for (const r of coll.records) records[r.slug] = stripInternal(r);
    collections[name] = { type: coll.type, records };
  }

  const singletons = {};
  for (const [name, s] of site.singletonsByName.entries()) singletons[name] = stripInternal(s);

  // Assets: object-keyed, with manifest metadata flattened on.
  const assets = {};
  for (const rel of site.assetsOnDisk) {
    const meta = (site.assetManifest && site.assetManifest[rel]) || {};
    assets[rel] = { ...meta };
  }
  // Include manifest-declared entries that aren't on disk (loader.js may use them).
  if (site.assetManifest) {
    for (const [rel, meta] of Object.entries(site.assetManifest)) {
      if (!(rel in assets)) assets[rel] = { ...meta };
    }
  }

  let tokens = null;
  const tokSingleton = site.singletonsByName.get("tokens");
  if (tokSingleton && tokSingleton.data) tokens = tokSingleton.data;
  else if (site.manifest && site.manifest.tokens) tokens = site.manifest.tokens;

  const siteObj = {
    ...(site.site || {}),
    defaultLocale: site.defaultLocale,
    locales: site.locales,
  };

  // routes keyed by URL (the loader uses object iteration here).
  const routes = {};
  for (const r of site.routes) routes[r.url] = { kind: r.kind, target: r.target };

  return {
    mosaic_version: (site.manifest && site.manifest.version) || "0.8",
    site: siteObj,
    manifest: site.manifest,
    pages,
    collections,
    singletons,
    assets,
    tokens,
    routes,
    redirects: site.redirects,
    diagnostics: site.diagnostics.sorted(),
  };
}
