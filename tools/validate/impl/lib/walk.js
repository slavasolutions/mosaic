"use strict";

// Walk the site filesystem: pages, collections, singletons, images.
// Detect record shapes (direct file / sidecar pair / folder with index).
// Emit slug.invalid, slug.case, record.empty, frontmatter.present.

const fs = require("node:fs");
const path = require("node:path");

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

// Reserved root names (SPEC §1.7) that are never singletons.
const RESERVED_ROOT = new Set([
  "mosaic.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "pages",
  "collections",
  "images",
]);

function relPath(siteRoot, abs) {
  const r = path.relative(siteRoot, abs).split(path.sep).join("/");
  return r;
}

function isHidden(name) {
  return name.startsWith(".") || name.startsWith("_");
}

function readDirSafe(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true });
  } catch (_) {
    return null;
  }
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (_) {
    return null;
  }
}

function parseJSONSafe(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Detect markdown frontmatter: file starts with "---\n" and another "---" line within a window.
function hasFrontmatter(text) {
  if (typeof text !== "string") return false;
  if (!text.startsWith("---")) return false;
  // accept --- at start followed by newline (or CRLF)
  const firstNl = text.indexOf("\n");
  if (firstNl !== 3 && !(firstNl === 4 && text[3] === "\r")) {
    return false;
  }
  // look for a closing --- on its own line within the first ~100 lines
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < Math.min(lines.length, 200); i++) {
    if (lines[i] === "---") return true;
  }
  return false;
}

// Find first H1 in markdown body (skip blank lines).
function firstH1(text) {
  if (typeof text !== "string") return null;
  const lines = text.split(/\r?\n/);
  let i = 0;
  // If frontmatter exists (shouldn't, but just in case), skip past it.
  if (lines[0] === "---") {
    let j = 1;
    while (j < lines.length && lines[j] !== "---") j++;
    if (j < lines.length) i = j + 1;
  }
  while (i < lines.length && lines[i].trim() === "") i++;
  for (; i < lines.length; i++) {
    const ln = lines[i];
    const m = /^# +(.+?)\s*$/.exec(ln);
    if (m) return m[1].trim();
    // Once we hit non-blank non-H1 content, stop (only "starts with" H1 counts).
    if (ln.trim() !== "") break;
  }
  return null;
}

// All H1/H2/H3/.. headings → list of {level, text, slug, lineIndex}
function allHeadings(text) {
  if (typeof text !== "string") return [];
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6}) +(.+?)\s*$/.exec(lines[i]);
    if (m) {
      out.push({
        level: m[1].length,
        text: m[2],
        slug: headingSlug(m[2]),
        lineIndex: i,
      });
    }
  }
  return out;
}

// SPEC §5.6 heading slug.
function headingSlug(text) {
  let s = text;
  // Already stripped leading '#'s and space by regex above.
  s = s.toLowerCase();
  s = s.replace(/\s+/g, "-");
  s = s.replace(/[^a-z0-9-]/g, "");
  s = s.replace(/^-+|-+$/g, "");
  return s;
}

// Resolve title (SPEC §2.3): JSON > H1 > slug-titlecase.
function resolveTitle(record) {
  if (record.json && typeof record.json.title === "string" && record.json.title.length > 0) {
    return { source: "json", value: record.json.title };
  }
  if (record.h1) {
    return { source: "h1", value: record.h1 };
  }
  if (record.slug) {
    const titlecased = record.slug
      .split("-")
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    return { source: "slug", value: titlecased };
  }
  return { source: "slug", value: "" };
}

// Build a record from a set of files. Returns { slug, location, mdPath?, jsonPath?, json?, md?, h1?, dataDir, sourcePath }.
function buildRecord(siteRoot, parentDir, slug, files, diagnostics) {
  const rec = {
    slug,
    parentDir,                  // e.g. "pages" or "collections/news"
    mdPath: null,               // relative path to .md (if any)
    jsonPath: null,             // relative path to .json (if any)
    json: null,
    jsonParseError: null,
    md: null,
    h1: null,
    location: files.location,   // "direct" | "folder"
    dataDir: files.dataDir,     // relative dir where ./ refs resolve (folder shape only — else null)
    sourcePath: files.sourcePath, // canonical source for diagnostics
  };

  if (files.mdAbs) {
    rec.mdPath = relPath(siteRoot, files.mdAbs);
    const text = readFileSafe(files.mdAbs);
    if (text !== null) {
      if (hasFrontmatter(text)) {
        diagnostics.structural(
          "mosaic.frontmatter.present",
          rec.mdPath,
          "markdown file begins with frontmatter, which is forbidden"
        );
      }
      rec.md = text;
      rec.h1 = firstH1(text);
      rec.headings = allHeadings(text);
    }
  }

  if (files.jsonAbs) {
    rec.jsonPath = relPath(siteRoot, files.jsonAbs);
    const text = readFileSafe(files.jsonAbs);
    if (text !== null) {
      const r = parseJSONSafe(text);
      if (!r.ok) {
        rec.jsonParseError = r.error;
        diagnostics.structural(
          "mosaic.config.invalid",
          rec.jsonPath,
          `JSON parse error: ${r.error}`
        );
      } else {
        rec.json = r.value;
      }
    }
  }

  if (!rec.md && !rec.json) {
    diagnostics.structural(
      "mosaic.record.empty",
      rec.sourcePath,
      "record has neither markdown nor JSON content"
    );
  }

  return rec;
}

// Enumerate records inside a directory (pages/ or collections/<name>/).
// Returns array of records.
function enumerateRecords(siteRoot, dirRel, diagnostics, opts) {
  const opts2 = opts || {};
  const allowIndex = opts2.allowIndex !== false; // pages and collections allow index records
  const dirAbs = path.join(siteRoot, dirRel);
  const entries = readDirSafe(dirAbs);
  if (!entries) return [];

  // Group by slug (case-insensitive for collision detection, case-sensitive for shape detection).
  const directBySlug = new Map(); // slug → { mdAbs?, jsonAbs?, slugLiteral }
  const folderBySlug = new Map(); // slug → { abs, slugLiteral }
  const slugCaseMap = new Map();  // lower-slug → first literal seen, for case-collision detection

  for (const ent of entries) {
    if (isHidden(ent.name)) continue;
    const abs = path.join(dirAbs, ent.name);

    if (ent.isFile()) {
      const m = /^(.+)\.(md|json)$/.exec(ent.name);
      if (!m) continue;
      const slugLiteral = m[1];
      const ext = m[2];

      // Index files are only valid inside folder-shape; at top level treat 'index' as a slug.
      // The minimal-site has pages/index.md → slug "index" (folder-shape-less index, valid for pages).
      // For pages, "index" → "/" URL; for collections, "index" is just a slug.
      // We accept; slug check below will pass since "index" matches the regex.

      const slugKey = slugLiteral;
      if (!directBySlug.has(slugKey)) {
        directBySlug.set(slugKey, { mdAbs: null, jsonAbs: null, slugLiteral });
      }
      const entry = directBySlug.get(slugKey);
      if (ext === "md") entry.mdAbs = abs;
      else entry.jsonAbs = abs;
    } else if (ent.isDirectory()) {
      folderBySlug.set(ent.name, { abs, slugLiteral: ent.name });
    }
  }

  const records = [];

  // 1) Process folder-shape records.
  for (const [slugLiteral, info] of folderBySlug) {
    // Validate slug
    if (!validateSlug(slugLiteral, path.posix.join(dirRel, slugLiteral), diagnostics)) {
      continue;
    }
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
    }, diagnostics);
    records.push(rec);
  }

  // 2) Process direct-shape records, flagging any that collide with a folder of the same slug.
  for (const [slugLiteral, info] of directBySlug) {
    if (folderBySlug.has(slugLiteral)) {
      // Folder + direct file with the same slug → two routes / records for the same slug.
      // For pages/, this is a route collision; for collections it's effectively a duplicate record.
      // The runner expects mosaic.route.collision at "pages/<slug>".
      diagnostics.structural(
        "mosaic.route.collision",
        path.posix.join(dirRel, slugLiteral),
        `slug "${slugLiteral}" exists both as a folder and as a direct file`
      );
      continue;
    }
    if (!validateSlug(slugLiteral, path.posix.join(dirRel, slugLiteral), diagnostics, { ...info, dirRel })) {
      continue;
    }
    if (!checkSlugCase(slugLiteral, slugCaseMap, dirRel, diagnostics, info)) continue;

    // Choose canonical source path for diagnostics: prefer .json, else .md, else dir.
    const sourceAbs = info.jsonAbs || info.mdAbs;
    const sourcePath = relPath(siteRoot, sourceAbs);

    // SPEC §5.5: `./` refs are valid in any record JSON. For a direct (sidecar or
    // single-JSON) record, the anchor is the parent dir. Only markdown-only records
    // have no defined "here" (and they have no JSON, so refs can't appear in them anyway).
    const rec = buildRecord(siteRoot, dirRel, slugLiteral, {
      mdAbs: info.mdAbs,
      jsonAbs: info.jsonAbs,
      location: "direct",
      dataDir: info.jsonAbs ? dirRel : null,
      sourcePath,
    }, diagnostics);
    records.push(rec);
  }

  return records;
}

function validateSlug(slug, sourcePath, diagnostics, fileInfo) {
  if (SLUG_RE.test(slug)) return true;
  // Find a representative file to point at, as a path relative to the dir we're walking.
  let src = sourcePath;
  if (fileInfo) {
    const dirRel = fileInfo.dirRel || "";
    if (fileInfo.jsonAbs) {
      src = dirRel ? path.posix.join(dirRel, slug + ".json") : slug + ".json";
    } else if (fileInfo.mdAbs) {
      src = dirRel ? path.posix.join(dirRel, slug + ".md") : slug + ".md";
    }
  }
  diagnostics.structural(
    "mosaic.slug.invalid",
    src,
    `slug "${slug}" doesn't match ^[a-z0-9][a-z0-9-]*$`
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
      `slug "${slug}" collides by case with "${slugCaseMap.get(key)}"`
    );
    return false;
  }
  slugCaseMap.set(key, slug);
  return true;
}

// Compute the URL of a page record per SPEC §3.1 (1-level only; deprecated in favor
// of enumeratePageTree which handles arbitrary depth).
function pageRecordUrl(pageRec) {
  if (pageRec.slug === "index") return "/";
  return "/" + pageRec.slug;
}

// Recursive page-tree walk for deep page hierarchies (SPEC §3.1: "the path from
// pages/ to the page determines its URL"). Pages can be arbitrarily deep:
//
//   pages/index.{md,json}                  -> /
//   pages/about.md                         -> /about
//   pages/about/index.md                   -> /about (folder-shape)
//   pages/about/team.md                    -> /about/team
//   pages/about/history/index.md           -> /about/history
//   pages/archive/2024/winter.json         -> /archive/2024/winter
//
// A directory under pages/ that has no index.{md,json} is NOT a record; it's a
// URL-prefix-only container. Its contents are still walked.
function enumeratePageTree(siteRoot, diagnostics) {
  const pagesDir = path.join(siteRoot, "pages");
  if (!fs.existsSync(pagesDir)) return [];
  const out = [];
  walkPagesDir(siteRoot, "pages", [], out, diagnostics);
  return out;
}

function walkPagesDir(siteRoot, dirRel, urlSegments, out, diagnostics) {
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
      const slug = m[1];
      const ext = m[2];
      if (!directBySlug.has(slug)) directBySlug.set(slug, { mdAbs: null, jsonAbs: null });
      const e = directBySlug.get(slug);
      if (ext === "md") e.mdAbs = abs;
      else e.jsonAbs = abs;
    } else if (ent.isDirectory()) {
      subdirs.push({ name: ent.name, abs });
    }
  }

  // `index.{md,json}` at a non-top-level dir has already been consumed by the parent's
  // folder-shape record at this dir's URL. Drop it from direct enumeration to avoid
  // double-recording the same content as both folder-shape and direct.
  if (urlSegments.length > 0) {
    directBySlug.delete("index");
  }

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
        `slug "${sub.name}" exists both as a folder and as a direct file under ${dirRel}`
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
      }, diagnostics);
      rec._url = "/" + segments.join("/");
      rec._pathSegments = segments;
      out.push(rec);
    }
    walkPagesDir(siteRoot, recRel, segments, out, diagnostics);
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
    }, diagnostics);

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

// Reserved-name check for declared singletons.
function isReservedRootName(name) {
  if (RESERVED_ROOT.has(name)) return true;
  if (isHidden(name)) return true;
  return false;
}

// Locate singleton files at site root (name.json, name.md, or both).
function locateSingleton(siteRoot, name) {
  const jsonAbs = path.join(siteRoot, name + ".json");
  const mdAbs = path.join(siteRoot, name + ".md");
  const result = { mdAbs: null, jsonAbs: null };
  if (fs.existsSync(jsonAbs) && fs.statSync(jsonAbs).isFile()) result.jsonAbs = jsonAbs;
  if (fs.existsSync(mdAbs) && fs.statSync(mdAbs).isFile()) result.mdAbs = mdAbs;
  return result;
}

module.exports = {
  enumerateRecords,
  enumeratePageTree,
  buildRecord,
  pageRecordUrl,
  isReservedRootName,
  locateSingleton,
  hasFrontmatter,
  firstH1,
  allHeadings,
  headingSlug,
  resolveTitle,
  relPath,
  readDirSafe,
  readFileSafe,
  parseJSONSafe,
  RESERVED_ROOT,
  SLUG_RE,
};
