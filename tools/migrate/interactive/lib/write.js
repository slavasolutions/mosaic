"use strict";

// Emit a Mosaic site from a confirmed plan.
// Pure file IO. Dry-run capable.

const fs = require("node:fs");
const path = require("node:path");

function emitSite(plan, scan, outDir, opts = {}) {
  const dryRun = !!opts.dryRun;
  const written = [];

  function mkdirp(p) {
    if (dryRun) return;
    fs.mkdirSync(p, { recursive: true });
  }

  function writeText(rel, content) {
    const abs = path.join(outDir, rel);
    written.push({ rel, bytes: Buffer.byteLength(content) });
    if (dryRun) return;
    mkdirp(path.dirname(abs));
    fs.writeFileSync(abs, content);
  }

  function writeJSON(rel, payload) {
    writeText(rel, JSON.stringify(payload, null, 2) + "\n");
  }

  function copyFile(absSrc, rel) {
    const abs = path.join(outDir, rel);
    let size = 0;
    try { size = fs.statSync(absSrc).size; } catch {}
    written.push({ rel, bytes: size, kind: "binary" });
    if (dryRun) return;
    mkdirp(path.dirname(abs));
    fs.copyFileSync(absSrc, abs);
  }

  // 1) mosaic.json
  const manifest = {
    $schema: "https://mosaic.dev/schemas/0.8.json",
    version: "0.8",
    site: {
      name: plan.site.name,
      locale: plan.site.locale,
      url: plan.site.url || undefined,
    },
    types: plan.types,
    collections: plan.collections,
    singletons: plan.singletons,
    redirects: plan.redirects,
  };
  // Strip undefined site fields (JSON.stringify drops them but keep tidy).
  if (!manifest.site.url) delete manifest.site.url;
  writeJSON("mosaic.json", manifest);

  // 2) pages/
  for (const pe of plan.pageEntries) {
    if (pe.payload) writeJSON(pe.targetRel, pe.payload);
  }
  // Ensure pages/ exists even if empty.
  mkdirp(path.join(outDir, "pages"));
  // Ensure collections/ exists even if empty.
  mkdirp(path.join(outDir, "collections"));

  // 3) collections/
  for (const ce of plan.collectionEntries) {
    if (ce.json && Object.keys(ce.json).length > 0) {
      writeJSON(ce.targetRel + ".json", ce.json);
    }
    if (ce.body && ce.body.trim()) {
      writeText(ce.targetRel + ".md", ce.body.endsWith("\n") ? ce.body : ce.body + "\n");
    }
  }

  // 4) singletons/
  for (const se of plan.singletonEntries) {
    if (se.payload) writeJSON(se.targetRel, se.payload);
  }

  // 5) messages.json singleton.
  if (plan.messagesPath) {
    const payload = require("./messages").loadMessagesPayload(scan.messages);
    writeJSON(plan.messagesPath, payload);
  }

  // 6) images/ + manifest.
  for (const asset of plan.assets) {
    copyFile(asset.absSource, asset.targetRel);
  }
  if (plan.assetsManifest && Object.keys(plan.assetsManifest).length) {
    writeJSON("images/manifest.json", plan.assetsManifest);
  }

  // 7) _astro-public/ — non-image public assets, ignored by Mosaic but kept for engine.
  for (const doc of plan.documents) {
    copyFile(doc.absSource, doc.targetRel);
  }

  return written;
}

function summarizeWritten(written) {
  const totalBytes = written.reduce((acc, w) => acc + (w.bytes || 0), 0);
  const byTopLevel = {};
  for (const w of written) {
    const top = w.rel.split("/")[0];
    byTopLevel[top] = (byTopLevel[top] || 0) + 1;
  }
  return { totalBytes, byTopLevel, fileCount: written.length };
}

module.exports = { emitSite, summarizeWritten };
