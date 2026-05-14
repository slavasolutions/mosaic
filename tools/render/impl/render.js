#!/usr/bin/env node
// Mosaic 0.8 reference renderer.
//
// Usage:
//   node render.js --site <path> --out <path> [--base <prefix>]
//
// Reads a Mosaic site folder, builds an in-memory index, and writes a basic
// HTML site to the output directory. Wireframe-quality. Correctness over polish.

import fs from "node:fs";
import path from "node:path";

import { Diagnostics } from "./lib/diagnostics.js";
import { buildIndex } from "./lib/build-index.js";
import { renderPage } from "./lib/render-page.js";
import { renderRedirect } from "./lib/render-redirect.js";
import { renderTokensCss, renderDefaultStylesCss } from "./lib/render-tokens.js";

function parseArgs(argv) {
  const args = { site: null, out: null, base: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--site") args.site = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--base") args.base = argv[++i] || "";
    else if (a === "--help" || a === "-h") {
      printUsage();
      process.exit(0);
    } else if (a.startsWith("--site=")) args.site = a.slice("--site=".length);
    else if (a.startsWith("--out=")) args.out = a.slice("--out=".length);
    else if (a.startsWith("--base=")) args.base = a.slice("--base=".length);
  }
  return args;
}

function printUsage() {
  process.stdout.write(
    "Usage: render.js --site <path> --out <path> [--base <prefix>]\n"
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.site || !args.out) {
    printUsage();
    process.exit(2);
  }
  const sitePath = path.resolve(args.site);
  const outPath = path.resolve(args.out);
  if (!fs.existsSync(sitePath) || !fs.statSync(sitePath).isDirectory()) {
    process.stderr.write(`error: site path not found: ${sitePath}\n`);
    process.exit(2);
  }

  const diagnostics = new Diagnostics();
  const index = buildIndex(sitePath, diagnostics);

  if (diagnostics.hasStructural()) {
    process.stderr.write("Structural diagnostics:\n");
    for (const d of diagnostics.sorted()) {
      if (d.severity !== "structural") continue;
      process.stderr.write(`  ${d.code} ${d.source}: ${d.message}\n`);
    }
    process.exit(1);
  }

  // Print drift / warning for visibility.
  let nonStructural = 0;
  for (const d of diagnostics.sorted()) {
    if (d.severity === "structural") continue;
    if (nonStructural === 0) process.stderr.write("Diagnostics:\n");
    process.stderr.write(`  [${d.severity}] ${d.code} ${d.source}: ${d.message}\n`);
    nonStructural++;
  }

  fs.mkdirSync(outPath, { recursive: true });

  let pagesWritten = 0;
  let recordsWritten = 0;
  let redirectsWritten = 0;
  let assetsWritten = 0;

  // ---- pages ----
  for (const url of Object.keys(index.pages)) {
    const page = index.pages[url];
    const html = renderPage({ kind: "page", record: page, url, index, base: args.base });
    const fileRel = urlToFileRel(url);
    writeFile(path.join(outPath, fileRel), html);
    pagesWritten++;
  }

  // ---- collection records (only those that have a routed URL) ----
  for (const cname of Object.keys(index.collections)) {
    const coll = index.collections[cname];
    for (const slug of Object.keys(coll.records)) {
      const rec = coll.records[slug];
      if (!rec.url) continue;
      const html = renderPage({ kind: "record", record: rec, url: rec.url, index, base: args.base });
      const fileRel = urlToFileRel(rec.url);
      writeFile(path.join(outPath, fileRel), html);
      recordsWritten++;
    }
  }

  // ---- redirects ----
  for (const r of index.redirects) {
    // Resolve the `to` URL the same way page links resolve: if --base is set,
    // prefix it; otherwise rewrite root-relative as page-relative so the
    // generated HTML works from `file://`.
    const toHref = args.base
      ? joinUrl(args.base, r.to)
      : rootToPageRelative(r.from, r.to);
    const html = renderRedirect({ to: toHref, status: r.status, locale: index.site.locale });
    const fileRel = urlToFileRel(r.from);
    writeFile(path.join(outPath, fileRel), html);
    redirectsWritten++;
  }

  // ---- assets: copy images verbatim ----
  for (const relAsset of Object.keys(index.assets)) {
    const meta = index.assets[relAsset];
    if (!meta.onDisk) continue;
    const dest = path.join(outPath, "images", relAsset);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      fs.copyFileSync(meta.fullPath, dest);
      assetsWritten++;
    } catch (_) {
      // best-effort copy
    }
  }

  // ---- record-local assets: copy any image co-located with a folder-shape
  // record (e.g. collections/team/anna/photo.jpg). The page output uses URLs
  // mirroring the on-disk path, so the copy targets the same relative location
  // under the output root. We only copy image-like files to avoid leaking
  // arbitrary content.
  copyRecordLocalAssets(index, outPath);

  // ---- tokens + styles ----
  fs.writeFileSync(path.join(outPath, "_tokens.css"), renderTokensCss(index.tokens), "utf8");
  fs.writeFileSync(path.join(outPath, "_styles.css"), renderDefaultStylesCss(), "utf8");

  process.stdout.write(
    `rendered: ${pagesWritten} pages, ${recordsWritten} records, ${redirectsWritten} redirects, ${assetsWritten} assets → ${outPath}\n`
  );
}

// Rewrite a root-relative `to` URL into a path relative to the redirect file's
// own location. /home redirects to /, written at <out>/home/index.html, so the
// target is `../`. Used so redirect pages work via file:// (no server).
function rootToPageRelative(fromUrl, toUrl) {
  if (typeof toUrl !== "string") return toUrl;
  if (/^[a-z][a-z0-9+.-]*:/i.test(toUrl) || toUrl.startsWith("//")) return toUrl;
  if (!toUrl.startsWith("/")) return toUrl;
  // depth of the `from` page (where the redirect HTML lives)
  const fromSegs = fromUrl.replace(/^\/+/, "").split("/").filter(Boolean);
  const prefix = "../".repeat(fromSegs.length);
  const target = toUrl.replace(/^\/+/, "");
  if (!target) return prefix || "./";
  return (prefix || "./") + target;
}

function copyRecordLocalAssets(index, outPath) {
  const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|avif)$/i;
  const visited = new Set();

  const walkDir = (absDir, relPosixDir) => {
    if (visited.has(absDir)) return;
    visited.add(absDir);
    let entries = [];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
      const full = path.join(absDir, e.name);
      if (e.isDirectory()) {
        walkDir(full, relPosixDir ? `${relPosixDir}/${e.name}` : e.name);
      } else if (e.isFile() && IMG_EXT.test(e.name)) {
        const dest = path.join(outPath, relPosixDir, e.name);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        try {
          fs.copyFileSync(full, dest);
        } catch (_) {}
      }
    }
  };

  // collections/<name>/<slug>/* (folder-shape records only)
  for (const cname of Object.keys(index.collections)) {
    const coll = index.collections[cname];
    for (const slug of Object.keys(coll.records)) {
      const rec = coll.records[slug];
      if (rec.location !== "folder") continue;
      walkDir(rec.dir, `collections/${cname}/${slug}`);
    }
  }
  // pages/<...>/<folder>/* (folder-shape pages)
  for (const url of Object.keys(index.pages)) {
    const page = index.pages[url];
    // Determine if this page is folder-shape: its files are inside a dedicated
    // directory under pages/ (i.e. files.json or files.md ends in /index.*).
    const refFile = page.files.json || page.files.md;
    if (!refFile) continue;
    const base = path.basename(refFile);
    if (base !== "index.md" && base !== "index.json") continue;
    const rel = path.relative(index.siteRoot, path.dirname(refFile)).replace(/\\/g, "/");
    walkDir(path.dirname(refFile), rel);
  }
}

function urlToFileRel(url) {
  // /         → index.html
  // /about    → about/index.html
  // /news/foo → news/foo/index.html
  // (We use the directory-index convention so links work without a server.)
  let u = String(url || "/");
  if (!u.startsWith("/")) u = "/" + u;
  if (u === "/") return "index.html";
  // strip leading slash
  const segs = u.replace(/^\/+/, "").split("/").filter(Boolean);
  return path.join(...segs, "index.html");
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function joinUrl(base, url) {
  if (!base) return url;
  if (typeof url !== "string") return base;
  if (/^https?:\/\//.test(url) || url.startsWith("mailto:") || url.startsWith("tel:")) return url;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  if (!url.startsWith("/")) return `${b}/${url}`;
  return `${b}${url}`;
}

main();
