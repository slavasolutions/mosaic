// Site filesystem enumeration: pages, collections, singletons, assets.
//
// Detects record shapes (direct / sidecar pair / folder-with-index), emits
// structural diagnostics for slug violations, record emptiness, frontmatter,
// route collisions. MIP-0014 locale-suffix files are collapsed onto the
// canonical record under `localeFiles`.

import fs from "node:fs";
import path from "node:path";

import { hasFrontmatter, firstH1, allHeadings } from "./markdown.js";
import { splitLocaleStem } from "./locales.js";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

// SPEC §1.7 reserved root names that are never singletons.
export const RESERVED_ROOT = new Set([
  "mosaic.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "NOTES.md",
  "pages",
  "collections",
  "images",
]);

export function isReservedRootName(name) {
  if (RESERVED_ROOT.has(name)) return true;
  if (name.startsWith(".") || name.startsWith("_")) return true;
  return false;
}

export function relPath(siteRoot, abs) {
  return path.relative(siteRoot, abs).split(path.sep).join("/");
}

export function isHidden(name) {
  return name.startsWith(".") || name.startsWith("_");
}

export function readDirSafe(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }); }
  catch { return null; }
}

export function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); }
  catch { return null; }
}

export function parseJSONSafe(text) {
  try { return { ok: true, value: JSON.parse(text) }; }
  catch (err) { return { ok: false, error: err.message }; }
}

// Build a record from a set of files. The returned shape is the universal
// "core record" used everywhere — adapters add their own fields on top.
//
// {
//   slug, parentDir,
//   mdPath, jsonPath,                       // POSIX site-relative paths
//   json, body, h1, headings,
//   data,                                   // alias for json (consumers prefer this)
//   files: { md, json },                    // SPEC §7.1 shape
//   shape: "direct" | "folder",
//   dataDir,                                // anchor for `./` refs (null if none)
//   here,                                   // absolute dir of the JSON file (adapter use)
//   sourcePath,                             // for diagnostic anchoring
// }
export function buildRecord(siteRoot, parentDir, slug, files, diagnostics) {
  const rec = {
    slug,
    parentDir,
    mdPath: null,
    jsonPath: null,
    json: null,
    data: null,
    body: null,
    h1: null,
    headings: [],
    files: { md: null, json: null },
    shape: files.location || "direct",
    location: files.location || "direct",
    dataDir: files.dataDir,
    here: files.here || (files.jsonAbs ? path.dirname(files.jsonAbs) : (files.mdAbs ? path.dirname(files.mdAbs) : null)),
    sourcePath: files.sourcePath,
  };

  if (files.mdAbs) {
    rec.mdPath = relPath(siteRoot, files.mdAbs);
    rec.files.md = rec.mdPath;
    const text = readFileSafe(files.mdAbs);
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

  if (files.jsonAbs) {
    rec.jsonPath = relPath(siteRoot, files.jsonAbs);
    rec.files.json = rec.jsonPath;
    const text = readFileSafe(files.jsonAbs);
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
      "record has neither markdown nor JSON content",
    );
  }

  return rec;
}

function validateSlug(slug, sourcePath, diagnostics, fileInfo) {
  if (SLUG_RE.test(slug)) return true;
  let src = sourcePath;
  if (fileInfo) {
    const dirRel = fileInfo.dirRel || "";
    if (fileInfo.jsonAbs) src = dirRel ? path.posix.join(dirRel, slug + ".json") : slug + ".json";
    else if (fileInfo.mdAbs) src = dirRel ? path.posix.join(dirRel, slug + ".md") : slug + ".md";
  }
  diagnostics.structural(
    "mosaic.slug.invalid",
    src,
    `slug "${slug}" doesn't match ^[a-z0-9][a-z0-9-]*$`,
  );
  return false;
}

function checkSlugCase(slug, slugCaseMap, dirRel, diagnostics, fileInfo) {
  const key = slug.toLowerCase();
  if (slugCaseMap.has(key) && slugCaseMap.get(key) !== slug) {
    let src;
    if (fileInfo && fileInfo.jsonAbs) src = fileInfo.jsonAbs;
    else if (fileInfo && fileInfo.mdAbs) src = fileInfo.mdAbs;
    else src = path.posix.join(dirRel, slug);
    diagnostics.structural(
      "mosaic.slug.case",
      typeof src === "string" ? src : path.posix.join(dirRel, slug),
      `slug "${slug}" collides by case with "${slugCaseMap.get(key)}"`,
    );
    return false;
  }
  slugCaseMap.set(key, slug);
  return true;
}

// Enumerate records inside a directory (collections/<name>/).
// `opts.locales` is the declared list of locales (for MIP-0014 file collapsing).
export function enumerateRecords(siteRoot, dirRel, diagnostics, opts) {
  const opts2 = opts || {};
  const locales = Array.isArray(opts2.locales) ? opts2.locales : [];
  const dirAbs = path.join(siteRoot, dirRel);
  const entries = readDirSafe(dirAbs);
  if (!entries) return [];

  const directBySlug = new Map();
  const folderBySlug = new Map();
  const slugCaseMap = new Map();

  for (const ent of entries) {
    if (isHidden(ent.name)) continue;
    const abs = path.join(dirAbs, ent.name);

    if (ent.isFile()) {
      if (ent.name === "manifest.json") continue;
      const m = /^(.+)\.(md|json)$/.exec(ent.name);
      if (!m) continue;
      const stem = m[1];
      const ext = m[2];
      if (stem === "index") continue; // collections: index.* is ignored per §2.6
      const localeInfo = splitLocaleStem(stem, locales);
      const slugLiteral = localeInfo.slug;
      const locale = localeInfo.locale;

      if (!directBySlug.has(slugLiteral)) {
        directBySlug.set(slugLiteral, { mdAbs: null, jsonAbs: null, slugLiteral });
      }
      const entry = directBySlug.get(slugLiteral);
      if (locale === null) {
        if (ext === "md") entry.mdAbs = abs;
        else entry.jsonAbs = abs;
      } else {
        entry.localeFiles = entry.localeFiles || {};
        const slot = (entry.localeFiles[locale] = entry.localeFiles[locale] || {});
        if (ext === "md") slot.mdAbs = abs;
        else slot.jsonAbs = abs;
      }
    } else if (ent.isDirectory()) {
      folderBySlug.set(ent.name, { abs, slugLiteral: ent.name });
    }
  }

  const records = [];

  // Folder-shape first.
  for (const [slugLiteral, info] of folderBySlug) {
    if (!validateSlug(slugLiteral, path.posix.join(dirRel, slugLiteral), diagnostics)) continue;
    if (!checkSlugCase(slugLiteral, slugCaseMap, dirRel, diagnostics)) continue;

    const folderEntries = readDirSafe(info.abs) || [];
    let mdAbs = null;
    let jsonAbs = null;
    for (const e of folderEntries) {
      if (e.isFile() && !isHidden(e.name)) {
        if (e.name === "index.md") mdAbs = path.join(info.abs, e.name);
        else if (e.name === "index.json") jsonAbs = path.join(info.abs, e.name);
      }
    }
    const recRel = path.posix.join(dirRel, slugLiteral);
    const rec = buildRecord(siteRoot, dirRel, slugLiteral, {
      mdAbs,
      jsonAbs,
      location: "folder",
      dataDir: recRel,
      sourcePath: recRel,
      here: info.abs,
    }, diagnostics);
    rec.localeFiles = null;
    records.push(rec);
  }

  // Direct shape.
  for (const [slugLiteral, info] of directBySlug) {
    if (folderBySlug.has(slugLiteral)) {
      diagnostics.structural(
        "mosaic.route.collision",
        path.posix.join(dirRel, slugLiteral),
        `slug "${slugLiteral}" exists both as a folder and as a direct file`,
      );
      continue;
    }
    if (!validateSlug(slugLiteral, path.posix.join(dirRel, slugLiteral), diagnostics, { ...info, dirRel })) continue;
    if (!checkSlugCase(slugLiteral, slugCaseMap, dirRel, diagnostics, info)) continue;

    const sourceAbs = info.jsonAbs || info.mdAbs;
    const sourcePath = relPath(siteRoot, sourceAbs);
    const rec = buildRecord(siteRoot, dirRel, slugLiteral, {
      mdAbs: info.mdAbs,
      jsonAbs: info.jsonAbs,
      location: "direct",
      dataDir: info.jsonAbs ? dirRel : null,
      sourcePath,
      here: dirAbs,
    }, diagnostics);
    rec.localeFiles = info.localeFiles || null;
    records.push(rec);
  }

  return records;
}

// Recursive page-tree walk (SPEC §3.1). Pages can be arbitrarily deep.
// Sets rec._url and rec._pathSegments.
export function enumeratePageTree(siteRoot, diagnostics, opts) {
  const pagesDir = path.join(siteRoot, "pages");
  if (!fs.existsSync(pagesDir)) return [];
  const out = [];
  const locales = (opts && Array.isArray(opts.locales)) ? opts.locales : [];
  walkPagesDir(siteRoot, "pages", [], out, diagnostics, locales);
  return out;
}

function walkPagesDir(siteRoot, dirRel, urlSegments, out, diagnostics, locales) {
  const dirAbs = path.join(siteRoot, dirRel);
  const entries = readDirSafe(dirAbs);
  if (!entries) return;

  const directBySlug = new Map();
  const subdirs = [];
  const slugCaseMap = new Map();

  for (const ent of entries) {
    if (isHidden(ent.name)) continue;
    const abs = path.join(dirAbs, ent.name);
    if (ent.isFile()) {
      const m = /^(.+)\.(md|json)$/.exec(ent.name);
      if (!m) continue;
      const stem = m[1];
      const ext = m[2];
      const { slug, locale } = splitLocaleStem(stem, locales);
      if (!directBySlug.has(slug)) directBySlug.set(slug, { mdAbs: null, jsonAbs: null });
      const e = directBySlug.get(slug);
      if (locale === null) {
        if (ext === "md") e.mdAbs = abs;
        else e.jsonAbs = abs;
      } else {
        e.localeFiles = e.localeFiles || {};
        const slot = (e.localeFiles[locale] = e.localeFiles[locale] || {});
        if (ext === "md") slot.mdAbs = abs;
        else slot.jsonAbs = abs;
      }
    } else if (ent.isDirectory()) {
      subdirs.push({ name: ent.name, abs });
    }
  }

  // A non-root dir's index.* is the folder-shape record at this URL.
  if (urlSegments.length > 0) directBySlug.delete("index");

  for (const sub of subdirs) {
    if (!validateSlug(sub.name, path.posix.join(dirRel, sub.name), diagnostics)) continue;
    if (!checkSlugCase(sub.name, slugCaseMap, dirRel, diagnostics)) continue;

    const subEntries = readDirSafe(sub.abs) || [];
    let mdAbs = null;
    let jsonAbs = null;
    for (const e of subEntries) {
      if (e.isFile() && !isHidden(e.name)) {
        if (e.name === "index.md") mdAbs = path.join(sub.abs, e.name);
        else if (e.name === "index.json") jsonAbs = path.join(sub.abs, e.name);
      }
    }

    if (directBySlug.has(sub.name)) {
      diagnostics.structural(
        "mosaic.route.collision",
        path.posix.join(dirRel, sub.name),
        `slug "${sub.name}" exists both as a folder and as a direct file under ${dirRel}`,
      );
      directBySlug.delete(sub.name);
      continue;
    }

    const segments = urlSegments.concat([sub.name]);
    const recRel = path.posix.join(dirRel, sub.name);

    if (mdAbs || jsonAbs) {
      const rec = buildRecord(siteRoot, dirRel, sub.name, {
        mdAbs,
        jsonAbs,
        location: "folder",
        dataDir: recRel,
        sourcePath: recRel,
        here: sub.abs,
      }, diagnostics);
      rec._url = "/" + segments.join("/");
      rec._pathSegments = segments;
      out.push(rec);
    }
    walkPagesDir(siteRoot, recRel, segments, out, diagnostics, locales);
  }

  for (const [slug, info] of directBySlug) {
    if (!validateSlug(slug, path.posix.join(dirRel, slug), diagnostics, { ...info, dirRel })) continue;
    if (!checkSlugCase(slug, slugCaseMap, dirRel, diagnostics, info)) continue;

    const sourceAbs = info.jsonAbs || info.mdAbs;
    const sourcePath = relPath(siteRoot, sourceAbs);
    const rec = buildRecord(siteRoot, dirRel, slug, {
      mdAbs: info.mdAbs,
      jsonAbs: info.jsonAbs,
      location: "direct",
      dataDir: info.jsonAbs ? dirRel : null,
      sourcePath,
      here: dirAbs,
    }, diagnostics);
    rec.localeFiles = info.localeFiles || null;

    if (urlSegments.length === 0 && slug === "index") {
      rec._url = "/";
      rec._pathSegments = [];
    } else if (slug === "index") {
      rec._url = "/" + urlSegments.join("/");
      rec._pathSegments = urlSegments.slice();
    } else {
      rec._url = "/" + urlSegments.concat([slug]).join("/");
      rec._pathSegments = urlSegments.concat([slug]);
    }
    out.push(rec);
  }
}

// Locate a singleton's files at the site root.
export function locateSingleton(siteRoot, name) {
  const jsonAbs = path.join(siteRoot, name + ".json");
  const mdAbs = path.join(siteRoot, name + ".md");
  const result = { mdAbs: null, jsonAbs: null };
  if (fs.existsSync(jsonAbs) && fs.statSync(jsonAbs).isFile()) result.jsonAbs = jsonAbs;
  if (fs.existsSync(mdAbs) && fs.statSync(mdAbs).isFile()) result.mdAbs = mdAbs;
  return result;
}

// Walk images/ recursively, collecting POSIX-relative paths into a Set.
export function walkAssets(imagesDir, prefix, outSet) {
  const ents = readDirSafe(imagesDir) || [];
  for (const ent of ents) {
    if (isHidden(ent.name)) continue;
    if (ent.name === "manifest.json" && prefix === "") continue;
    const rel = prefix ? prefix + "/" + ent.name : ent.name;
    if (ent.isDirectory()) walkAssets(path.join(imagesDir, ent.name), rel, outSet);
    else if (ent.isFile()) outSet.add(rel);
  }
}
