"use strict";

// Build an in-memory Mosaic index per SPEC §7.
// Not a full validator: we do enough structural checking to refuse to render
// truly broken sites, but skip drift/warning analyses that aren't needed for
// rendering. Refs are emitted as stubs; rendering follows them on demand.

const fs = require("node:fs");
const path = require("node:path");

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const NAME_RE = /^[a-z][a-z0-9-]*$/;

const RESERVED_ROOT_NAMES = new Set([
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

function readJsonSafe(filePath, diagnostics, sourceLabel) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    diagnostics.structural(
      "mosaic.config.invalid",
      sourceLabel,
      `failed to read: ${err.message}`
    );
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    diagnostics.structural(
      "mosaic.config.invalid",
      sourceLabel,
      `invalid JSON: ${err.message}`
    );
    return null;
  }
}

function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_) {
    return null;
  }
}

function loadManifest(sitePath, diagnostics) {
  const manifestPath = path.join(sitePath, "mosaic.json");
  if (!fs.existsSync(manifestPath)) {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      "mosaic.json not found at site root"
    );
    return null;
  }
  return readJsonSafe(manifestPath, diagnostics, "mosaic.json");
}

// Title precedence per SPEC §2.3.
function resolveTitle(data, body, slug) {
  if (data && typeof data.title === "string" && data.title.length > 0) {
    return data.title;
  }
  if (body) {
    // First non-blank line; if it's `# foo`, use foo.
    const match = body.match(/^\s*#\s+(.+?)\s*$/m);
    if (match) {
      const idx = body.indexOf(match[0]);
      const before = body.slice(0, idx);
      if (/^\s*$/.test(before)) return match[1];
    }
  }
  if (!slug) return "Untitled";
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// For a directory, find records: either folder-shape (subdir/index.{md,json})
// or direct (.md / .json / pair). Returns { slug, files, location }.
function enumerateRecords(dirPath, dirRelLabel, diagnostics) {
  const records = new Map();
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (_) {
    return records;
  }

  // First pass: folder-shape records (subdirectories).
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
    const fullPath = path.join(dirPath, e.name);
    if (e.isDirectory()) {
      const slug = e.name;
      if (!SLUG_RE.test(slug)) {
        diagnostics.structural(
          "mosaic.slug.invalid",
          path.join(dirRelLabel, slug),
          `slug "${slug}" doesn't match ^[a-z0-9][a-z0-9-]*$`
        );
        continue;
      }
      const indexMd = path.join(fullPath, "index.md");
      const indexJson = path.join(fullPath, "index.json");
      const hasMd = fs.existsSync(indexMd);
      const hasJson = fs.existsSync(indexJson);
      if (!hasMd && !hasJson) {
        // Directory exists but no record file. Skip.
        continue;
      }
      records.set(slug, {
        slug,
        location: "folder",
        dir: fullPath,
        relDir: path.join(dirRelLabel, slug),
        files: {
          md: hasMd ? indexMd : null,
          json: hasJson ? indexJson : null,
        },
      });
    }
  }

  // Second pass: direct records. Group .md + .json by stem.
  const directStems = new Map();
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
    if (e.name === "manifest.json") continue;
    const ext = path.extname(e.name).toLowerCase();
    if (ext !== ".md" && ext !== ".json") continue;
    const stem = e.name.slice(0, e.name.length - ext.length);
    if (stem === "index") {
      // index.md / index.json directly inside dir = top-level page at this dir
      // Caller handles this case for pages/. For collections, these are
      // ignored per SPEC §2.6.
      if (!directStems.has(stem)) directStems.set(stem, { md: null, json: null });
      directStems.get(stem)[ext === ".md" ? "md" : "json"] = path.join(dirPath, e.name);
      continue;
    }
    if (!SLUG_RE.test(stem)) {
      diagnostics.structural(
        "mosaic.slug.invalid",
        path.join(dirRelLabel, e.name),
        `slug "${stem}" doesn't match ^[a-z0-9][a-z0-9-]*$`
      );
      continue;
    }
    if (!directStems.has(stem)) directStems.set(stem, { md: null, json: null });
    directStems.get(stem)[ext === ".md" ? "md" : "json"] = path.join(dirPath, e.name);
  }

  for (const [stem, files] of directStems) {
    if (stem === "index") continue; // handled elsewhere
    if (records.has(stem)) {
      // Collision: folder + direct same slug. Treat as error and prefer folder.
      diagnostics.structural(
        "mosaic.slug.case",
        path.join(dirRelLabel, stem),
        `slug "${stem}" appears as both folder and direct record`
      );
      continue;
    }
    records.set(stem, {
      slug: stem,
      location: "direct",
      dir: dirPath,
      relDir: dirRelLabel,
      files,
    });
  }

  return { records, directStems };
}

function loadRecord(rec, diagnostics) {
  let data = null;
  let body = null;
  if (rec.files.json) {
    const relLabel = path.relative(rec._siteRoot, rec.files.json);
    data = readJsonSafe(rec.files.json, diagnostics, relLabel);
    if (data === null) data = {};
  }
  if (rec.files.md) {
    const text = readTextSafe(rec.files.md);
    if (text !== null) {
      // Frontmatter detection.
      if (/^---\s*\n/.test(text)) {
        const relLabel = path.relative(rec._siteRoot, rec.files.md);
        diagnostics.structural(
          "mosaic.frontmatter.present",
          relLabel,
          "markdown file begins with frontmatter"
        );
      }
      body = text;
    }
  }
  rec.data = data || {};
  rec.body = body;
  rec.title = resolveTitle(rec.data, rec.body, rec.slug);
  // The JSON file's directory (for relative ref resolution).
  rec.jsonDir = rec.files.json ? path.dirname(rec.files.json) : null;
  return rec;
}

// Map pages/<path> to URL per SPEC §3.1.
function pageUrlFromRelPath(relPath) {
  // relPath is POSIX-ish: e.g. "index.md", "about.md", "annual-report-2024/index.json"
  let u = relPath.replace(/\\/g, "/");
  // strip extension
  if (u.endsWith("/index.md") || u.endsWith("/index.json")) {
    u = u.slice(0, u.length - "/index.md".length); // both same length, 9 chars
  } else if (u === "index.md" || u === "index.json") {
    return "/";
  } else if (u.endsWith(".md") || u.endsWith(".json")) {
    u = u.replace(/\.(md|json)$/, "");
  }
  if (!u.startsWith("/")) u = "/" + u;
  return u;
}

function buildIndex(sitePath, diagnostics) {
  const siteRoot = path.resolve(sitePath);
  const index = {
    mosaic_version: "0.8",
    siteRoot,
    site: { name: "", locale: undefined, url: undefined },
    pages: {},
    collections: {},
    singletons: {},
    assets: {},
    assetsManifest: {},
    tokens: null,
    routes: {},
    redirects: [],
    diagnostics: [],
  };

  const manifest = loadManifest(siteRoot, diagnostics);
  if (!manifest) return index;
  index.manifest = manifest;

  if (manifest.site && typeof manifest.site === "object") {
    index.site.name = manifest.site.name || "";
    index.site.locale = manifest.site.locale;
    index.site.url = manifest.site.url;
  }

  // ---- assets ----
  const imagesDir = path.join(siteRoot, "images");
  if (fs.existsSync(imagesDir)) {
    const manifestFile = path.join(imagesDir, "manifest.json");
    if (fs.existsSync(manifestFile)) {
      const am = readJsonSafe(manifestFile, diagnostics, "images/manifest.json");
      if (am && typeof am === "object") index.assetsManifest = am;
    }
    walkAssets(imagesDir, imagesDir, index.assets);
  }

  // ---- singletons ----
  if (manifest.singletons && typeof manifest.singletons === "object") {
    for (const sname of Object.keys(manifest.singletons)) {
      if (!NAME_RE.test(sname)) continue;
      if (RESERVED_ROOT_NAMES.has(sname)) {
        diagnostics.structural(
          "mosaic.singleton.reserved",
          "mosaic.json",
          `singleton "${sname}" collides with reserved root name`
        );
        continue;
      }
      const jsonPath = path.join(siteRoot, `${sname}.json`);
      const mdPath = path.join(siteRoot, `${sname}.md`);
      const hasJson = fs.existsSync(jsonPath);
      const hasMd = fs.existsSync(mdPath);
      if (!hasJson && !hasMd) {
        diagnostics.structural(
          "mosaic.singleton.missing",
          `${sname}.json`,
          `singleton "${sname}" declared but no file at site root`
        );
        continue;
      }
      const rec = {
        slug: sname,
        location: "direct",
        dir: siteRoot,
        relDir: "",
        files: { json: hasJson ? jsonPath : null, md: hasMd ? mdPath : null },
        _siteRoot: siteRoot,
      };
      loadRecord(rec, diagnostics);
      index.singletons[sname] = rec;
    }
  }

  // tokens singleton wins over inline.
  if (index.singletons.tokens) {
    index.tokens = index.singletons.tokens.data || null;
  } else if (manifest.tokens && typeof manifest.tokens === "object") {
    index.tokens = manifest.tokens;
  }

  // ---- collections ----
  const collectionsDir = path.join(siteRoot, "collections");
  if (fs.existsSync(collectionsDir)) {
    let cEntries = [];
    try {
      cEntries = fs.readdirSync(collectionsDir, { withFileTypes: true });
    } catch (_) {}
    for (const e of cEntries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
      const cname = e.name;
      if (!NAME_RE.test(cname)) continue;
      const cdir = path.join(collectionsDir, cname);
      const { records } = enumerateRecords(cdir, `collections/${cname}`, diagnostics);
      const recMap = {};
      for (const rec of records.values()) {
        rec._siteRoot = siteRoot;
        loadRecord(rec, diagnostics);
        rec.url = null; // will be set later when a page mounts the collection
        recMap[rec.slug] = rec;
      }
      const cType = manifest.collections && manifest.collections[cname]
        ? manifest.collections[cname].type
        : undefined;
      index.collections[cname] = {
        name: cname,
        type: cType,
        defaultSort: manifest.collections && manifest.collections[cname]
          ? manifest.collections[cname].defaultSort
          : undefined,
        defaultMount: manifest.collections && manifest.collections[cname]
          ? manifest.collections[cname].defaultMount
          : undefined,
        records: recMap,
      };
    }
  }

  // ---- pages ----
  const pagesDir = path.join(siteRoot, "pages");
  if (fs.existsSync(pagesDir)) {
    walkPages(pagesDir, "", siteRoot, index, diagnostics);
  }

  // home reserved check.
  if (
    fs.existsSync(path.join(pagesDir, "home")) ||
    fs.existsSync(path.join(pagesDir, "home.md")) ||
    fs.existsSync(path.join(pagesDir, "home.json"))
  ) {
    diagnostics.structural(
      "mosaic.home.reserved",
      "pages/home",
      "pages/home.* is reserved; engines alias /home to /"
    );
  }

  // ---- routes + collection mounts ----
  // Routes from pages.
  for (const url of Object.keys(index.pages)) {
    if (index.routes[url]) {
      diagnostics.structural(
        "mosaic.route.collision",
        url,
        `multiple pages claim URL ${url}`
      );
    }
    index.routes[url] = { kind: "page", target: url };
  }
  // Scan each page for collection-list sections.
  for (const url of Object.keys(index.pages)) {
    const page = index.pages[url];
    const sections = Array.isArray(page.data && page.data.sections)
      ? page.data.sections
      : [];
    for (const sec of sections) {
      if (!sec || typeof sec !== "object") continue;
      if (sec.type !== "collection-list") continue;
      const from = typeof sec.from === "string" ? sec.from : null;
      if (!from) continue;
      const cname = from.startsWith("collections/")
        ? from.slice("collections/".length)
        : from;
      const coll = index.collections[cname];
      if (!coll) {
        diagnostics.structural(
          "mosaic.collection.missing",
          page.relPath,
          `collection-list references missing collection "${from}"`
        );
        continue;
      }
      const routesEnabled = sec.routes !== false;
      if (!routesEnabled) continue;
      const urlPattern = typeof sec.urlPattern === "string"
        ? sec.urlPattern
        : (url === "/" ? "/{slug}" : `${url}/{slug}`);
      for (const slug of Object.keys(coll.records)) {
        const recordUrl = urlPattern.replace("{slug}", slug);
        const existing = index.routes[recordUrl];
        if (existing && existing.kind === "record" && existing.target !== `${cname}/${slug}`) {
          diagnostics.structural(
            "mosaic.route.collision",
            recordUrl,
            `URL ${recordUrl} claimed by multiple records`
          );
          continue;
        }
        if (existing && existing.kind === "page") {
          diagnostics.structural(
            "mosaic.route.collision",
            recordUrl,
            `URL ${recordUrl} claimed by page and record`
          );
          continue;
        }
        if (!existing) {
          index.routes[recordUrl] = { kind: "record", target: `${cname}/${slug}` };
        }
        // Set record's url to the first one we encountered (and stable).
        if (!coll.records[slug].url) coll.records[slug].url = recordUrl;
      }
    }
  }

  // ---- redirects ----
  const explicit = Array.isArray(manifest.redirects) ? manifest.redirects.slice() : [];
  // redirects singleton wins.
  if (index.singletons.redirects && index.singletons.redirects.data) {
    const rules = Array.isArray(index.singletons.redirects.data.rules)
      ? index.singletons.redirects.data.rules
      : [];
    if (rules.length) {
      if (explicit.length) {
        diagnostics.warning(
          "mosaic.redirect.duplicate-source",
          "mosaic.json",
          "redirects exist in both mosaic.json and redirects singleton; singleton wins"
        );
      }
      explicit.length = 0;
      explicit.push(...rules);
    }
  }

  const redirects = [];
  // Auto /home → / unless overridden.
  const hasExplicitHome = explicit.some((r) => r && r.from === "/home");
  if (!hasExplicitHome) {
    redirects.push({ from: "/home", to: "/", status: 301, source: "auto" });
  }
  for (const r of explicit) {
    if (!r || typeof r !== "object") continue;
    if (typeof r.from !== "string" || typeof r.to !== "string") continue;
    redirects.push({
      from: r.from,
      to: r.to,
      status: typeof r.status === "number" ? r.status : 301,
      source: "manifest",
    });
  }

  // Detect loops (simple direct cycle): A→B and B→A.
  const map = new Map();
  for (const r of redirects) map.set(r.from, r.to);
  for (const r of redirects) {
    let cur = r.to;
    const seen = new Set([r.from]);
    let hops = 0;
    while (map.has(cur) && hops < 20) {
      if (seen.has(cur)) {
        diagnostics.structural(
          "mosaic.redirect.loop",
          r.from,
          `redirect loop starting at ${r.from}`
        );
        break;
      }
      seen.add(cur);
      cur = map.get(cur);
      hops++;
    }
  }

  // Collision: redirect from = real route.
  for (const r of redirects) {
    if (r.from === "/home") continue; // auto-redirect is fine, page index lives at /
    if (index.routes[r.from] && index.routes[r.from].kind !== "redirect") {
      diagnostics.structural(
        "mosaic.redirect.collision",
        r.from,
        `redirect from ${r.from} collides with real route`
      );
    }
  }

  index.redirects = redirects;
  for (const r of redirects) {
    if (!index.routes[r.from]) {
      index.routes[r.from] = { kind: "redirect", target: r.to, status: r.status };
    }
  }

  return index;
}

function walkAssets(imagesDir, currentDir, out) {
  let entries;
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
    if (e.name === "manifest.json" && currentDir === imagesDir) continue;
    const full = path.join(currentDir, e.name);
    if (e.isDirectory()) {
      walkAssets(imagesDir, full, out);
    } else if (e.isFile()) {
      const rel = path.relative(imagesDir, full).replace(/\\/g, "/");
      out[rel] = { onDisk: true, fullPath: full };
    }
  }
}

function walkPages(pagesDir, relPrefix, siteRoot, index, diagnostics) {
  let entries;
  try {
    entries = fs.readdirSync(pagesDir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  // Treat each immediate entry. For directories, recurse + also check index.{md,json}.
  // Direct files become pages with their slug; folders need either index.* or are descended into.
  const dirIndex = { md: null, json: null };
  const directFiles = new Map(); // stem -> { md, json }
  const subdirs = [];

  for (const e of entries) {
    if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
    const full = path.join(pagesDir, e.name);
    if (e.isDirectory()) {
      subdirs.push({ name: e.name, full });
      continue;
    }
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (ext !== ".md" && ext !== ".json") continue;
    const stem = e.name.slice(0, e.name.length - ext.length);
    if (stem === "index") {
      dirIndex[ext === ".md" ? "md" : "json"] = full;
      continue;
    }
    if (!SLUG_RE.test(stem)) {
      diagnostics.structural(
        "mosaic.slug.invalid",
        path.join("pages", relPrefix, e.name),
        `slug "${stem}" doesn't match ^[a-z0-9][a-z0-9-]*$`
      );
      continue;
    }
    if (!directFiles.has(stem)) directFiles.set(stem, { md: null, json: null });
    directFiles.get(stem)[ext === ".md" ? "md" : "json"] = full;
  }

  // Emit dir's own index page (if present).
  if (dirIndex.md || dirIndex.json) {
    const relPath = path.posix.join("pages", relPrefix, "index" + (dirIndex.json ? ".json" : ".md"));
    const url = relPrefix === "" ? "/" : "/" + relPrefix.replace(/\\/g, "/").replace(/\/$/, "");
    addPage(index, diagnostics, {
      url,
      relPath,
      files: dirIndex,
      siteRoot,
    });
  }

  // Emit direct-file pages.
  for (const [stem, files] of directFiles) {
    const url = "/" + path.posix.join(relPrefix, stem).replace(/\\/g, "/");
    const relPath = path.posix.join(
      "pages",
      relPrefix,
      stem + (files.json ? ".json" : ".md")
    );
    addPage(index, diagnostics, { url, relPath, files, siteRoot });
  }

  // Recurse into subdirs that have either an index record or further nesting.
  for (const { name, full } of subdirs) {
    if (!SLUG_RE.test(name)) {
      diagnostics.structural(
        "mosaic.slug.invalid",
        path.join("pages", relPrefix, name),
        `slug "${name}" doesn't match ^[a-z0-9][a-z0-9-]*$`
      );
      continue;
    }
    walkPages(full, path.posix.join(relPrefix, name), siteRoot, index, diagnostics);
  }
}

function addPage(index, diagnostics, opts) {
  const { url, relPath, files, siteRoot } = opts;
  const rec = {
    slug: url === "/" ? "" : url.slice(url.lastIndexOf("/") + 1),
    location: files.md && files.json && path.dirname(files.md) === path.dirname(files.json) ? "pair" : "direct",
    dir: path.dirname(files.json || files.md),
    relDir: path.dirname(relPath),
    files,
    _siteRoot: siteRoot,
    url,
    relPath,
  };
  loadRecord(rec, diagnostics);
  if (index.pages[url]) {
    diagnostics.structural(
      "mosaic.route.collision",
      url,
      `multiple pages produce URL ${url}`
    );
    return;
  }
  index.pages[url] = rec;
}

module.exports = { buildIndex };
