// Thin renderer-side adapter over @mosaic/core's loadSite.
//
// The renderer's existing render-page.js and resolve-refs.js were written
// against a Map-of-plain-objects shape (index.pages, index.collections.<name>.records,
// index.singletons, index.assets, index.assetsManifest). This module preserves
// that shape so the rest of the renderer stays unchanged.

import path from "node:path";
import fs from "node:fs";

import { loadSite } from "../../../core/src/index.js";

export function buildIndex(sitePath, diagnostics) {
  const site = loadSite(sitePath, { diagnostics });
  const siteRoot = site.siteRoot;

  const index = {
    mosaic_version: (site.manifest && site.manifest.version) || "0.8",
    siteRoot,
    site: {
      name: site.site?.name || "",
      locale: site.site?.locale ?? site.defaultLocale,
      url: site.site?.url,
    },
    pages: {},
    collections: {},
    singletons: {},
    assets: {},
    assetsManifest: site.assetManifest || {},
    tokens: null,
    routes: {},
    redirects: [],
    diagnostics: [],
    manifest: site.manifest,
  };

  // pages: keyed by URL
  for (const p of site.pages) {
    const rec = adaptRecord(p, siteRoot);
    rec.url = p.url;
    rec.relPath = p.jsonPath || p.mdPath || p.sourcePath;
    index.pages[p.url] = rec;
  }

  // collections
  for (const [cname, coll] of site.collectionsByName) {
    const recordsObj = {};
    for (const r of coll.records) {
      const rec = adaptRecord(r, siteRoot);
      rec.url = site.recordUrls.get(r) || r.url || null;
      recordsObj[r.slug] = rec;
    }
    index.collections[cname] = {
      name: cname,
      type: coll.type,
      defaultSort: coll.defaultSort,
      defaultMount: coll.defaultMount,
      records: recordsObj,
    };
  }

  // singletons
  for (const [name, s] of site.singletonsByName) {
    index.singletons[name] = adaptRecord(s, siteRoot);
  }

  // tokens: singleton wins, else manifest.tokens
  if (index.singletons.tokens) index.tokens = index.singletons.tokens.data || null;
  else if (site.manifest && site.manifest.tokens) index.tokens = site.manifest.tokens;

  // assets: { rel: { onDisk, fullPath, ...manifest meta } }
  for (const rel of site.assetsOnDisk) {
    const meta = (site.assetManifest && site.assetManifest[rel]) || {};
    index.assets[rel] = {
      onDisk: true,
      fullPath: path.join(siteRoot, "images", rel),
      ...meta,
    };
  }

  // routes: keyed by URL (renderer iterates keys for diagnostics + redirect HTML)
  for (const r of site.routes) {
    index.routes[r.url] = { kind: r.kind, target: r.target };
  }

  // redirects: with `source` field. Auto-detect the auto entry by `to === "/"` and `from === "/home"`
  // when the route table contains it (core marks source explicitly in builtRedirects).
  index.redirects = site.redirects.map((r) => ({
    from: r.from,
    to: r.to,
    status: r.status,
    source: r.source,
  }));

  return index;
}

function adaptRecord(r, siteRoot) {
  // The renderer's existing code (copyRecordLocalAssets, etc.) expects
  // `files.json` / `files.md` to be absolute paths, the same shape the
  // pre-refactor build-index produced.
  const filesAbs = {};
  if (r.files && r.files.json) filesAbs.json = path.join(siteRoot, r.files.json);
  if (r.files && r.files.md) filesAbs.md = path.join(siteRoot, r.files.md);

  const out = {
    slug: r.slug,
    location: r.location || r.shape,
    files: filesAbs,
    data: r.data || {},
    body: r.body || null,
    title: r.title || "",
    dir: r.here || siteRoot,
    relDir: r.dataDir || "",
    _siteRoot: siteRoot,
    jsonDir: null,
  };
  if (filesAbs.json) out.jsonDir = path.dirname(filesAbs.json);
  else if (r.here) out.jsonDir = r.here;
  // For the renderer, ensure `data` is the same object the renderer can scan
  // for sections / fields. Core already deep-merged locale views into rec.data.
  return out;
}

// Re-export for compatibility with tools that imported these.
export { fileExists } from "./markdown.js";
