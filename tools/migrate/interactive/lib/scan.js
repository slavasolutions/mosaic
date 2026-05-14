"use strict";

// Walk a source Astro site and report what's there.
// Pure inspection — no filesystem mutation.

const fs = require("node:fs");
const path = require("node:path");
const { detectMessages } = require("./messages");

function readDirSafe(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; }
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function readTextSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function parseJSONSafe(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function walkFiles(root, opts = {}) {
  const { maxDepth = 8, skipDirs = new Set(["node_modules", ".git", "dist", ".astro", ".vercel", ".vscode", ".next", "build", "out"]) } = opts;
  const out = [];
  function go(dir, depth) {
    if (depth > maxDepth) return;
    for (const entry of readDirSafe(dir)) {
      if (entry.name.startsWith(".") && entry.name !== ".inlang") {
        if (entry.name !== ".vscode") {/* still skip below */}
      }
      if (skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { go(full, depth + 1); continue; }
      if (entry.isFile()) out.push(full);
    }
  }
  go(root, 0);
  return out;
}

function classifyPageFile(absPath, sourceRoot) {
  const rel = path.relative(path.join(sourceRoot, "src/pages"), absPath);
  const ext = path.extname(absPath);
  const isDynamic = /\[/.test(rel);
  const isApi = rel.startsWith("api/") || rel.startsWith("api" + path.sep);
  const isXml = absPath.endsWith(".xml.ts") || absPath.endsWith(".xml.js");
  const baseName = path.basename(rel, ext);

  return {
    kind: ext === ".astro" ? "astro" : ext === ".md" || ext === ".mdx" ? "markdown" : "other",
    ext,
    rel,
    relUnix: rel.split(path.sep).join("/"),
    isDynamic,
    isApi,
    isXml,
    slug: baseName,
  };
}

// Look at content/<name>/. Detect whether it's a JSON-record collection,
// markdown-record collection, or mixed (per-locale variants).
function classifyCollection(name, dirAbs) {
  const records = [];
  const localesSeen = new Set();
  const entries = readDirSafe(dirAbs);
  let hasJson = false;
  let hasMd = false;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // folder-shaped record (Astro allows this for assets) — index.* inside
      const indexJson = path.join(dirAbs, entry.name, "index.json");
      const indexMd = path.join(dirAbs, entry.name, "index.md");
      const has = fileExists(indexJson) || fileExists(indexMd);
      if (has) {
        records.push({ slug: entry.name, shape: "folder", path: path.join(dirAbs, entry.name), locale: null });
        if (fileExists(indexJson)) hasJson = true;
        if (fileExists(indexMd)) hasMd = true;
      }
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (![".md", ".mdx", ".json"].includes(ext)) continue;
    const stem = path.basename(entry.name, ext);
    // Detect locale suffix: <slug>.<locale>
    const m = stem.match(/^(.+?)\.([a-z]{2}(?:-[A-Z]{2})?)$/);
    let slug = stem;
    let locale = null;
    if (m) {
      slug = m[1];
      locale = m[2];
      localesSeen.add(locale);
    }
    records.push({ slug, shape: "direct", path: path.join(dirAbs, entry.name), ext, locale });
    if (ext === ".json") hasJson = true;
    else hasMd = true;
  }

  return {
    name,
    dirAbs,
    records,
    locales: Array.from(localesSeen),
    hasJson,
    hasMd,
    perLocale: localesSeen.size > 0,
  };
}

function scanSource(sourceRoot) {
  const report = {
    sourceRoot,
    astroConfig: null,
    siteUrl: null,
    siteRedirects: {},
    packageJson: null,
    contentCollections: [],   // [ { name, recordCount, locales, hasJson, hasMd, perLocale } ]
    pages: [],                // page descriptors
    publicFiles: [],          // relative paths under public/
    publicImageBytes: 0,
    messages: null,
    componentsCount: 0,
    layoutsCount: 0,
    hasInlang: false,
    notes: [],
  };

  // package.json
  const pkgPath = path.join(sourceRoot, "package.json");
  const pkgRaw = readTextSafe(pkgPath);
  report.packageJson = pkgRaw ? parseJSONSafe(pkgRaw) : null;

  // astro.config.mjs / .ts / .js
  for (const name of ["astro.config.mjs", "astro.config.ts", "astro.config.js"]) {
    const p = path.join(sourceRoot, name);
    if (fileExists(p)) {
      const text = readTextSafe(p);
      report.astroConfig = { path: p, text };
      report.siteUrl = extractSiteUrl(text);
      report.siteRedirects = extractRedirects(text);
      break;
    }
  }

  // content collections
  const contentDir = path.join(sourceRoot, "src/content");
  if (dirExists(contentDir)) {
    for (const entry of readDirSafe(contentDir)) {
      if (!entry.isDirectory()) continue;
      const c = classifyCollection(entry.name, path.join(contentDir, entry.name));
      report.contentCollections.push({
        name: c.name,
        recordCount: c.records.length,
        locales: c.locales,
        hasJson: c.hasJson,
        hasMd: c.hasMd,
        perLocale: c.perLocale,
        records: c.records,
        dirAbs: c.dirAbs,
      });
    }
  }

  // pages
  const pagesDir = path.join(sourceRoot, "src/pages");
  if (dirExists(pagesDir)) {
    const files = walkFiles(pagesDir);
    for (const f of files) {
      report.pages.push(classifyPageFile(f, sourceRoot));
    }
  }

  // public/ images and other assets
  const publicDir = path.join(sourceRoot, "public");
  if (dirExists(publicDir)) {
    for (const f of walkFiles(publicDir, { maxDepth: 12 })) {
      const rel = path.relative(publicDir, f);
      let size = 0;
      try { size = fs.statSync(f).size; } catch {}
      const isImage = /\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/i.test(f);
      report.publicFiles.push({ absPath: f, rel: rel.split(path.sep).join("/"), size, isImage });
      if (isImage) report.publicImageBytes += size;
    }
  }

  // messages / inlang
  report.messages = detectMessages(sourceRoot);
  report.hasInlang = report.messages && report.messages.kind === "inlang";

  // components + layouts (count only)
  const componentsDir = path.join(sourceRoot, "src/components");
  if (dirExists(componentsDir)) {
    report.componentsCount = walkFiles(componentsDir).filter((p) => p.endsWith(".astro") || p.endsWith(".jsx") || p.endsWith(".tsx")).length;
  }
  const layoutsDir = path.join(sourceRoot, "src/layouts");
  if (dirExists(layoutsDir)) {
    report.layoutsCount = walkFiles(layoutsDir).filter((p) => p.endsWith(".astro")).length;
  }

  return report;
}

function extractSiteUrl(astroConfigText) {
  if (!astroConfigText) return null;
  // Match: site: 'https://...'
  const m = astroConfigText.match(/site\s*:\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

function extractRedirects(astroConfigText) {
  if (!astroConfigText) return {};
  // Find redirects: { ... }
  const start = astroConfigText.indexOf("redirects:");
  if (start === -1) return {};
  // Find the matching { ... } block after the colon.
  let i = astroConfigText.indexOf("{", start);
  if (i === -1) return {};
  let depth = 0;
  let end = -1;
  for (let j = i; j < astroConfigText.length; j++) {
    const ch = astroConfigText[j];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { end = j; break; }
    }
  }
  if (end === -1) return {};
  const block = astroConfigText.slice(i + 1, end);
  // Strip line comments. Crude but the input we expect uses // ... and /* ... */.
  const noLineComments = block.replace(/\/\/.*$/gm, "");
  const noBlockComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
  const redirects = {};
  // Match 'from': 'to' or "from": "to"
  const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(noBlockComments)) !== null) {
    redirects[m[1]] = m[2];
  }
  return redirects;
}

module.exports = { scanSource, classifyCollection, classifyPageFile };
