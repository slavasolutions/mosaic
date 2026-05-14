// Build an in-memory Mosaic site index per SPEC §7.
//
// loadSite(sitePath) — returns the structure consumers actually use:
//   { site, manifest, pages, collections, singletons, assets, tokens,
//     routes, redirects, diagnostics, defaultLocale, locales,
//     // internals adapters need:
//     siteRoot, recordUrls, assetManifest, allRecords,
//     collectionsByName, singletonsByName, refsToCollections, assetReferences }
//
// The shape is a superset of the spec's §7.1 index. emitIndex(site) extracts
// the normative subset for serialization.

import fs from "node:fs";
import path from "node:path";

import { Diagnostics } from "./diagnostics.js";
import { loadManifest } from "./manifest.js";
import {
  enumerateRecords,
  enumeratePageTree,
  locateSingleton,
  walkAssets,
  isReservedRootName,
  readDirSafe,
  readFileSafe,
  parseJSONSafe,
  buildRecord,
  relPath,
} from "./walk.js";
import {
  looksLikeRef,
  parseRef,
  walkStringValues,
  resolveSelector,
} from "./refs.js";
import { resolveSiteLocales, deepClone, deepMerge, resolveTranslatable } from "./locales.js";
import { resolveTitle, hasFrontmatter, firstH1, allHeadings } from "./markdown.js";
import { buildRoutes } from "./routes.js";

// Public: load and assemble a Mosaic site from disk.
// `opts.diagnostics` (optional) — pre-existing Diagnostics instance.
export function loadSite(sitePath, opts) {
  const siteRoot = path.resolve(sitePath);
  const diagnostics = (opts && opts.diagnostics) || new Diagnostics();

  if (!fs.existsSync(siteRoot) || !fs.statSync(siteRoot).isDirectory()) {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      `site path "${sitePath}" not found or not a directory`,
    );
    return finalize(emptySite(siteRoot, diagnostics));
  }

  const manifest = loadManifest(siteRoot, diagnostics);
  if (!manifest) {
    return finalize(emptySite(siteRoot, diagnostics));
  }

  const site = newSite(siteRoot, manifest, diagnostics);

  indexPages(site, diagnostics);
  indexCollectionsDir(site, diagnostics);
  indexSingletons(site, diagnostics);
  indexAssets(site, diagnostics);

  const { routes, redirects } = buildRoutes(site, diagnostics);
  site.routes = routes;
  site.redirects = redirects;

  resolveLocaleViews(site, diagnostics);
  resolveAllRefs(site, diagnostics);

  return finalize(site);
}

function newSite(siteRoot, manifest, diagnostics) {
  const { defaultLocale, locales } = resolveSiteLocales(manifest.site);
  if (manifest.site && Array.isArray(manifest.site.locales) && !manifest.site.locales.includes(defaultLocale)) {
    diagnostics.drift(
      "mosaic.locale.unknown-default",
      "mosaic.json",
      `site.defaultLocale "${defaultLocale}" is not listed in site.locales`,
    );
  }
  return {
    siteRoot,
    sitePath: siteRoot,
    manifest,
    site: manifest.site || { name: "" },
    pages: [],
    collectionsByName: new Map(),
    singletonsByName: new Map(),
    assetsOnDisk: new Set(),
    assetManifest: null,
    assetReferences: new Set(),
    refsToCollections: new Set(),
    recordUrls: new Map(),
    routedCollections: new Set(),
    allRecords: [],
    locales,
    defaultLocale,
    routes: [],
    redirects: [],
    diagnostics,
  };
}

function emptySite(siteRoot, diagnostics) {
  return {
    siteRoot,
    sitePath: siteRoot,
    manifest: null,
    site: { name: "" },
    pages: [],
    collectionsByName: new Map(),
    singletonsByName: new Map(),
    assetsOnDisk: new Set(),
    assetManifest: null,
    assetReferences: new Set(),
    refsToCollections: new Set(),
    recordUrls: new Map(),
    routedCollections: new Set(),
    allRecords: [],
    locales: ["en"],
    defaultLocale: "en",
    routes: [],
    redirects: [],
    diagnostics,
  };
}

function indexPages(site, diagnostics) {
  const pagesDir = path.join(site.siteRoot, "pages");
  if (!fs.existsSync(pagesDir)) return;
  const opts = { locales: site.locales };
  const pageRecs = enumeratePageTree(site.siteRoot, diagnostics, opts);
  pageRecs.forEach((rec) => {
    const segs = rec._pathSegments || [];
    if (segs.length === 1 && segs[0] === "home") {
      diagnostics.structural(
        "mosaic.home.reserved",
        rec.sourcePath,
        'the slug "home" is reserved at the top of pages/',
      );
      rec._url = null;
    }
  });
  site.pages = pageRecs.filter((r) => r._url !== null);
  for (const r of site.pages) {
    site.allRecords.push(r);
    r.url = r._url;
  }
}

function indexCollectionsDir(site, diagnostics) {
  const collectionsDir = path.join(site.siteRoot, "collections");
  if (!fs.existsSync(collectionsDir)) return;
  const ents = readDirSafe(collectionsDir) || [];
  const manifest = site.manifest;
  const opts = { locales: site.locales };
  for (const ent of ents) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith(".") || ent.name.startsWith("_")) continue;
    const collName = ent.name;
    const records = enumerateRecords(site.siteRoot, `collections/${collName}`, diagnostics, opts);
    const recordsBySlug = new Map();
    for (const r of records) {
      recordsBySlug.set(r.slug.toLowerCase(), r);
      site.allRecords.push(r);
    }
    const decl = (manifest.collections && manifest.collections[collName]) || {};
    site.collectionsByName.set(collName, {
      name: collName,
      type: decl.type,
      defaultSort: decl.defaultSort,
      defaultMount: decl.defaultMount,
      records,
      recordsBySlug,
    });
  }
}

function indexSingletons(site, diagnostics) {
  const manifest = site.manifest;
  const singletons = (manifest.singletons && typeof manifest.singletons === "object") ? manifest.singletons : {};
  // Tolerate 0.7-era "globals" key.
  if (Object.keys(singletons).length === 0 && manifest.globals && typeof manifest.globals === "object") {
    for (const k of Object.keys(manifest.globals)) singletons[k] = manifest.globals[k];
  }
  for (const sname of Object.keys(singletons)) {
    if (isReservedRootName(sname) || isReservedRootName(sname + ".json") || isReservedRootName(sname + ".md")) {
      diagnostics.structural(
        "mosaic.singleton.reserved",
        "mosaic.json",
        `singleton name "${sname}" collides with a reserved root name`,
      );
      continue;
    }
    const loc = locateSingleton(site.siteRoot, sname);
    if (!loc.mdAbs && !loc.jsonAbs) {
      diagnostics.structural(
        "mosaic.singleton.missing",
        `${sname}.json`,
        `declared singleton "${sname}" has no file at site root`,
      );
      continue;
    }
    const rec = buildSingletonRecord(site.siteRoot, sname, loc, diagnostics);
    rec.type = singletons[sname]?.type;
    site.singletonsByName.set(sname, rec);
    site.allRecords.push(rec);
  }
}

function buildSingletonRecord(siteRoot, sname, loc, diagnostics) {
  const rec = {
    slug: sname,
    parentDir: "",
    mdPath: null,
    jsonPath: null,
    json: null,
    data: null,
    body: null,
    h1: null,
    headings: [],
    files: { md: null, json: null },
    shape: "direct",
    location: "direct",
    dataDir: null,
    here: siteRoot,
    sourcePath: loc.jsonAbs ? path.relative(siteRoot, loc.jsonAbs) : path.relative(siteRoot, loc.mdAbs),
    isSingleton: true,
  };
  if (loc.mdAbs) {
    rec.mdPath = relPath(siteRoot, loc.mdAbs);
    rec.files.md = rec.mdPath;
    const text = readFileSafe(loc.mdAbs);
    if (text !== null) {
      if (hasFrontmatter(text)) {
        diagnostics.structural(
          "mosaic.frontmatter.present",
          rec.mdPath,
          "markdown file begins with frontmatter, which is forbidden",
        );
      }
      rec.body = text;
      rec.h1 = firstH1(text);
      rec.headings = allHeadings(text);
    }
  }
  if (loc.jsonAbs) {
    rec.jsonPath = relPath(siteRoot, loc.jsonAbs);
    rec.files.json = rec.jsonPath;
    const text = readFileSafe(loc.jsonAbs);
    if (text !== null) {
      const r = parseJSONSafe(text);
      if (!r.ok) {
        diagnostics.structural(
          "mosaic.config.invalid",
          rec.jsonPath,
          `JSON parse error: ${r.error}`,
        );
        rec.json = {};
        rec.data = {};
      } else {
        rec.json = r.value;
        rec.data = r.value;
      }
    }
  }
  if (!rec.body && !rec.json) {
    diagnostics.structural(
      "mosaic.record.empty",
      rec.sourcePath,
      "singleton has neither markdown nor JSON content",
    );
  }
  return rec;
}

function indexAssets(site, diagnostics) {
  const imagesDir = path.join(site.siteRoot, "images");
  if (!fs.existsSync(imagesDir)) return;
  walkAssets(imagesDir, "", site.assetsOnDisk);
  const manifestAbs = path.join(imagesDir, "manifest.json");
  if (fs.existsSync(manifestAbs)) {
    const text = readFileSafe(manifestAbs);
    const parsed = text ? parseJSONSafe(text) : null;
    if (parsed && parsed.ok && parsed.value && typeof parsed.value === "object") {
      site.assetManifest = parsed.value;
    } else if (parsed && !parsed.ok) {
      diagnostics.structural(
        "mosaic.config.invalid",
        "images/manifest.json",
        `images/manifest.json: ${parsed.error}`,
      );
    }
  }
}

// Build per-record `localized[<locale>]` views from base + locale-suffix
// sibling files + translatable-field unwrapping. Sets canonical
// data/body/title to the default-locale view.
function resolveLocaleViews(site, diagnostics) {
  const { defaultLocale } = site;
  for (const rec of site.allRecords) {
    // Read locale sidecars from rec.localeFiles into raw maps.
    const localeJsonRaw = {};
    const localeBodies = {};
    if (rec.localeFiles) {
      for (const [loc, slot] of Object.entries(rec.localeFiles)) {
        if (slot.jsonAbs) {
          const text = readFileSafe(slot.jsonAbs);
          if (text != null) {
            const r = parseJSONSafe(text);
            if (r.ok) {
              localeJsonRaw[loc] = r.value;
            } else {
              diagnostics.structural(
                "mosaic.config.invalid",
                relPath(site.siteRoot, slot.jsonAbs),
                `JSON parse error: ${r.error}`,
              );
              localeJsonRaw[loc] = {};
            }
          }
        }
        if (slot.mdAbs) {
          const text = readFileSafe(slot.mdAbs);
          if (text != null) {
            if (hasFrontmatter(text)) {
              diagnostics.structural(
                "mosaic.frontmatter.present",
                relPath(site.siteRoot, slot.mdAbs),
                "markdown file begins with frontmatter, which is forbidden",
              );
            }
            localeBodies[loc] = text;
          }
        }
      }
    }

    const localesCovered = new Set();
    if (rec.json || rec.body) localesCovered.add(defaultLocale);
    for (const l of Object.keys(localeJsonRaw)) localesCovered.add(l);
    for (const l of Object.keys(localeBodies)) localesCovered.add(l);

    rec.locales = [
      ...(localesCovered.has(defaultLocale) ? [defaultLocale] : []),
      ...[...localesCovered].filter((l) => l !== defaultLocale).sort(),
    ];

    rec.localized = {};
    for (const L of rec.locales) {
      const baseClone = deepClone(rec.json || {});
      const merged = deepMerge(baseClone, localeJsonRaw[L] || {});
      const resolved = resolveTranslatable(merged, L, defaultLocale, (key) => {
        diagnostics.warning(
          "mosaic.locale.missing",
          rec.sourcePath || rec.slug,
          `translatable field "${key}" has no value for locale "${L}"`,
        );
      });
      const body = localeBodies[L] !== undefined ? localeBodies[L] : (rec.body || "");
      const localeTitle = resolveTitle({ data: resolved, body, slug: rec.slug });
      rec.localized[L] = {
        data: resolved,
        body,
        title: localeTitle.value,
      };
    }

    const defView = rec.localized[defaultLocale];
    if (defView) {
      rec.data = defView.data;
      rec.body = defView.body;
      rec.title = defView.title;
    } else {
      rec.title = resolveTitle(rec).value;
    }
  }
}

// Walk every record's JSON, resolve refs, emit diagnostics. Also tracks
// asset references for the orphan/unmanifested passes.
function resolveAllRefs(site, diagnostics) {
  for (const rec of site.allRecords) {
    if (!rec.json) continue;
    walkStringValues(rec.json, (visit) => {
      const value = visit.value;
      if (!looksLikeRef(value)) return;
      const parsed = parseRef(value);
      const src = rec.jsonPath || rec.sourcePath;

      if (!parsed.ok) {
        diagnostics.structural(
          "mosaic.ref.malformed",
          src,
          `malformed ref "${value}": ${parsed.error}`,
        );
        return;
      }

      if (parsed.kind === "relative") {
        if (!rec.dataDir) {
          diagnostics.structural(
            "mosaic.relative.invalid",
            src,
            `relative ref "${value}" used in a record without a containing folder`,
          );
          return;
        }
        // For folder-shape records, only verify the target if it's not a
        // markdown file (markdown sections resolve at render time).
        const abs = path.join(site.siteRoot, rec.dataDir, parsed.path);
        if (!fs.existsSync(abs)) {
          diagnostics.drift(
            "mosaic.ref.unresolved",
            src,
            `relative path "${parsed.path}" does not exist`,
          );
        }
        return;
      }

      if (parsed.kind === "asset") {
        let rel = parsed.path;
        if (rel.startsWith("images/")) rel = rel.slice("images/".length);
        const abs = path.join(site.siteRoot, "images", rel);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
          diagnostics.drift(
            "mosaic.ref.unresolved",
            src,
            `asset "${parsed.path}" not found on disk`,
          );
          return;
        }
        site.assetReferences.add(rel);
        if (site.assetManifest && !(rel in site.assetManifest)) {
          diagnostics.warning(
            "mosaic.asset.unmanifested",
            "images/" + rel,
            `asset "${rel}" exists on disk but not in images/manifest.json`,
          );
        }
        return;
      }

      // ref:
      if (parsed.singleton) {
        const s = site.singletonsByName.get(parsed.singleton);
        if (!s) {
          diagnostics.drift(
            "mosaic.ref.unresolved",
            src,
            `singleton "${parsed.singleton}" not found`,
          );
          return;
        }
        if (parsed.selector) {
          const r = resolveSelector(parsed.selector, s);
          if (!r.ok) {
            diagnostics.drift(
              "mosaic.selector.unresolved",
              src,
              `selector "${parsed.selector}" not found in singleton "${parsed.singleton}"`,
            );
          }
        }
        return;
      }

      const coll = site.collectionsByName.get(parsed.collection);
      if (!coll) {
        diagnostics.drift(
          "mosaic.ref.unresolved",
          src,
          `collection "${parsed.collection}" not found`,
        );
        return;
      }
      const recTarget = coll.recordsBySlug.get(parsed.slug.toLowerCase());
      if (!recTarget) {
        diagnostics.drift(
          "mosaic.ref.unresolved",
          src,
          `record "${parsed.collection}/${parsed.slug}" not found`,
        );
        return;
      }
      site.refsToCollections.add(parsed.collection);
      if (parsed.selector) {
        const r = resolveSelector(parsed.selector, recTarget);
        if (!r.ok) {
          diagnostics.drift(
            "mosaic.selector.unresolved",
            src,
            `selector "${parsed.selector}" not found in "${parsed.collection}/${parsed.slug}"`,
          );
        }
      }
    });
  }
}

function finalize(site) {
  // Touch up assets-on-disk view (for orphan warning callers).
  return site;
}

// Look up a record by collection + slug. Returns the record (or null).
// `opts.locale` selects the localized view (defaults to defaultLocale).
export function getRecord(site, collection, slug, opts) {
  const coll = site.collectionsByName.get(collection);
  if (!coll) return null;
  const rec = coll.recordsBySlug.get(slug.toLowerCase());
  if (!rec) return null;
  const locale = (opts && opts.locale) || site.defaultLocale;
  return projectLocale(rec, locale, site.defaultLocale);
}

// Look up a singleton by name. Optional `opts.locale`.
export function getSingleton(site, name, opts) {
  const rec = site.singletonsByName.get(name);
  if (!rec) return null;
  const locale = (opts && opts.locale) || site.defaultLocale;
  return projectLocale(rec, locale, site.defaultLocale);
}

function projectLocale(rec, locale, defaultLocale) {
  if (!rec.localized) return rec;
  const view = rec.localized[locale] || rec.localized[defaultLocale];
  if (!view) return rec;
  return { ...rec, data: view.data, body: view.body, title: view.title, locale };
}

// Resolve a single ref string against a loaded site. Returns a stub-shaped
// object per SPEC §5.8 (with extras: `value` for selector-resolved scalars).
export function resolveRef(site, refString, opts) {
  if (typeof refString !== "string") return null;
  const parsed = parseRef(refString);
  if (!parsed.ok) return { $error: parsed.error, original: refString };
  const ctxDir = (opts && opts.contextDir) || null;
  return resolveRefInternal(site, parsed, ctxDir);
}

function resolveRefInternal(site, parsed, contextDir) {
  if (parsed.kind === "asset") {
    let rel = parsed.path;
    if (rel.startsWith("images/")) rel = rel.slice("images/".length);
    const meta = site.assetManifest ? site.assetManifest[rel] : null;
    const onDisk = site.assetsOnDisk.has(rel);
    return {
      $asset: "images/" + rel,
      onDisk,
      ...(meta || {}),
    };
  }
  if (parsed.kind === "relative") {
    const stub = { $rel: "./" + parsed.path };
    if (contextDir) {
      const abs = path.resolve(contextDir, parsed.path);
      const rel = path.relative(site.siteRoot, abs).split(path.sep).join("/");
      stub.path = rel;
    }
    if (parsed.selector) stub.selector = parsed.selector;
    return stub;
  }
  // ref:
  if (parsed.singleton) {
    const s = site.singletonsByName.get(parsed.singleton);
    if (!s) return { $ref: parsed.address, url: null, title: parsed.singleton, unresolved: true };
    const stub = { $ref: parsed.address, url: null, title: s.title || s.slug };
    if (parsed.selector) {
      const r = resolveSelector(parsed.selector, s);
      stub.selector = parsed.selector;
      if (r.ok) stub.value = r.value;
    }
    return stub;
  }
  const coll = site.collectionsByName.get(parsed.collection);
  if (!coll) return { $ref: parsed.address, url: null, title: parsed.slug, unresolved: true };
  const rec = coll.recordsBySlug.get(parsed.slug.toLowerCase());
  if (!rec) return { $ref: parsed.address, url: null, title: parsed.slug, unresolved: true };
  const url = site.recordUrls.get(rec) || rec.url || null;
  const stub = { $ref: parsed.address, url, title: rec.title || rec.slug };
  if (parsed.selector) {
    const r = resolveSelector(parsed.selector, rec);
    stub.selector = parsed.selector;
    if (r.ok) stub.value = r.value;
  }
  return stub;
}

// Emit the SPEC §7.1 index from a loaded site. JSON-serializable.
export function emitIndex(site) {
  const pages = {};
  for (const p of site.pages) {
    pages[p.url] = serializePage(p);
  }
  const collections = {};
  for (const [name, coll] of site.collectionsByName.entries()) {
    const records = {};
    for (const r of coll.records) {
      records[r.slug] = serializeRecord(r, site);
    }
    collections[name] = { type: coll.type, records };
  }
  const singletons = {};
  for (const [name, s] of site.singletonsByName.entries()) {
    singletons[name] = serializeRecord(s, site);
  }
  const assets = {};
  for (const rel of site.assetsOnDisk) {
    const meta = (site.assetManifest && site.assetManifest[rel]) || {};
    assets[rel] = { ...meta, onDisk: true };
  }

  // Tokens: singleton wins.
  let tokens = null;
  const tokSingleton = site.singletonsByName.get("tokens");
  if (tokSingleton && tokSingleton.data) tokens = tokSingleton.data;
  else if (site.manifest && site.manifest.tokens) tokens = site.manifest.tokens;

  return {
    mosaic_version: (site.manifest && site.manifest.version) || "0.8",
    site: site.site,
    pages,
    collections,
    singletons,
    assets,
    tokens,
    routes: site.routes.slice().sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0),
    redirects: site.redirects,
    diagnostics: site.diagnostics.sorted(),
  };
}

function serializePage(rec) {
  const out = {
    shape: rec.shape,
    files: { ...rec.files },
    title: rec.title || rec.slug,
  };
  if (rec.data) out.data = rec.data;
  if (rec.body) out.body = rec.body;
  if (rec.data && Array.isArray(rec.data.sections)) out.sections = rec.data.sections;
  if (rec.url) out.url = rec.url;
  return out;
}

function serializeRecord(rec, site) {
  const out = {
    shape: rec.shape,
    files: { ...rec.files },
    title: rec.title || rec.slug,
  };
  if (rec.data) out.data = rec.data;
  if (rec.body) out.body = rec.body;
  const url = site.recordUrls.get(rec) || rec.url || null;
  out.url = url;
  return out;
}
