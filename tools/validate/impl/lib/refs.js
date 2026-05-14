"use strict";

// Ref grammar parser + resolver per SPEC §5.

const fs = require("node:fs");
const path = require("node:path");

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const PATH_SEGMENT_RE = /^[A-Za-z0-9_.\-]+$/;
const SELECTOR_SEGMENT_RE = /^[a-z0-9_-]+$/;

const REF_PREFIXES = ["ref:", "asset:", "./"];

function looksLikeRef(s) {
  if (typeof s !== "string") return false;
  for (const p of REF_PREFIXES) {
    if (s.startsWith(p)) return true;
  }
  return false;
}

function parseRef(s) {
  if (typeof s !== "string") return { ok: false, error: "not a string" };

  if (s.startsWith("ref:")) {
    const rest = s.slice(4);
    const atIdx = rest.indexOf("@");
    const addr = atIdx >= 0 ? rest.slice(0, atIdx) : rest;
    const selector = atIdx >= 0 ? rest.slice(atIdx + 1) : null;
    const addrParse = parseAddress(addr);
    if (!addrParse.ok) return { ok: false, error: addrParse.error };
    if (selector !== null) {
      const selParse = parseSelector(selector);
      if (!selParse.ok) return { ok: false, error: selParse.error };
    }
    return {
      ok: true,
      kind: "ref",
      address: addr,
      singleton: addrParse.singleton || null,
      collection: addrParse.collection,
      slug: addrParse.slug,
      selector,
    };
  }

  if (s.startsWith("asset:")) {
    const rest = s.slice(6);
    if (rest.length === 0) return { ok: false, error: "empty asset path" };
    if (rest.indexOf("@") >= 0) {
      return { ok: false, error: "asset refs MUST NOT carry selectors" };
    }
    const segs = rest.split("/");
    for (const seg of segs) {
      if (!PATH_SEGMENT_RE.test(seg)) {
        return { ok: false, error: `asset path segment "${seg}" invalid` };
      }
    }
    return { ok: true, kind: "asset", path: rest };
  }

  if (s.startsWith("./")) {
    const rest = s.slice(2);
    if (rest.length === 0) return { ok: false, error: "empty relative path" };
    const atIdx = rest.indexOf("@");
    const relPath = atIdx >= 0 ? rest.slice(0, atIdx) : rest;
    const selector = atIdx >= 0 ? rest.slice(atIdx + 1) : null;
    const segs = relPath.split("/");
    for (const seg of segs) {
      if (!PATH_SEGMENT_RE.test(seg)) {
        return { ok: false, error: `relative path segment "${seg}" invalid` };
      }
    }
    if (selector !== null) {
      const selParse = parseSelector(selector);
      if (!selParse.ok) return { ok: false, error: selParse.error };
    }
    return { ok: true, kind: "relative", path: relPath, selector };
  }

  return { ok: false, error: "string is not a ref" };
}

function parseAddress(addr) {
  if (!addr || typeof addr !== "string") {
    return { ok: false, error: "empty address" };
  }
  const slashIdx = addr.indexOf("/");
  if (slashIdx < 0) {
    if (!NAME_RE.test(addr)) {
      return { ok: false, error: `singleton name "${addr}" invalid` };
    }
    return { ok: true, collection: null, slug: null, singleton: addr };
  }
  const collection = addr.slice(0, slashIdx);
  const slug = addr.slice(slashIdx + 1);
  if (!NAME_RE.test(collection)) {
    return { ok: false, error: `collection name "${collection}" invalid` };
  }
  if (!NAME_RE.test(slug)) {
    return { ok: false, error: `slug "${slug}" invalid` };
  }
  // SPEC: "No deeper paths. No nesting."
  if (slug.indexOf("/") >= 0) {
    return { ok: false, error: "address contains nested slash" };
  }
  return { ok: true, collection, slug };
}

function parseSelector(sel) {
  if (!sel || typeof sel !== "string") {
    return { ok: false, error: "empty selector" };
  }
  // Heading-slug form is itself a single segment matching [a-z0-9-]+.
  // JSON-path form is dot-separated [a-z0-9_-]+ (or integers for arrays).
  // We accept either; resolver will try both.
  const segs = sel.split(".");
  for (const seg of segs) {
    if (!SELECTOR_SEGMENT_RE.test(seg)) {
      return { ok: false, error: `selector segment "${seg}" invalid` };
    }
  }
  return { ok: true, segments: segs };
}

// Walk every string value in a record's JSON. For each ref-looking value, call cb({path, value, raw}).
function walkStringValues(node, cb, pathArr) {
  pathArr = pathArr || [];
  if (typeof node === "string") {
    cb({ value: node, path: pathArr.slice() });
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      walkStringValues(node[i], cb, pathArr.concat([i]));
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) {
      walkStringValues(node[k], cb, pathArr.concat([k]));
    }
  }
}

// Resolve a parsed ref against the site index. Returns one of:
//   { ok: true, kind: "record" | "singleton" | "asset" | "relative", target, url, title, selectorResolved }
//   { ok: false, reason: "unresolved" | "selector" | "relative_invalid" | "asset_missing", message }
function resolveRef(parsed, ctx) {
  // ctx: { siteIndex, hostRecord, sitePath }
  const { siteIndex, hostRecord, sitePath } = ctx;

  if (parsed.kind === "ref") {
    if (parsed.singleton) {
      const s = siteIndex.singletonsByName.get(parsed.singleton);
      if (!s) {
        return { ok: false, reason: "unresolved", message: `singleton "${parsed.singleton}" not found` };
      }
      const selResult = parsed.selector ? resolveSelector(parsed.selector, s) : null;
      if (parsed.selector && !selResult.ok) {
        return { ok: false, reason: "selector", message: `selector "${parsed.selector}" not found in singleton "${parsed.singleton}"` };
      }
      return {
        ok: true,
        kind: "singleton",
        target: s,
        url: null,
        title: titleOf(s),
        selectorResolved: selResult ? selResult.value : null,
      };
    }
    // Collection record
    const coll = siteIndex.collectionsByName.get(parsed.collection);
    if (!coll) {
      return { ok: false, reason: "unresolved", message: `collection "${parsed.collection}" not found` };
    }
    const rec = coll.recordsBySlug.get(parsed.slug.toLowerCase());
    if (!rec) {
      return { ok: false, reason: "unresolved", message: `record "${parsed.collection}/${parsed.slug}" not found` };
    }
    const selResult = parsed.selector ? resolveSelector(parsed.selector, rec) : null;
    if (parsed.selector && !selResult.ok) {
      return { ok: false, reason: "selector", message: `selector "${parsed.selector}" not found in "${parsed.collection}/${parsed.slug}"` };
    }
    return {
      ok: true,
      kind: "record",
      target: rec,
      url: siteIndex.recordUrls.get(rec) || null,
      title: titleOf(rec),
      selectorResolved: selResult ? selResult.value : null,
    };
  }

  if (parsed.kind === "asset") {
    // path is "images/<path>" or "<path>"? SPEC says asset:images/<path>. We accept both shapes
    // (start with "images/" or not) but the canonical form starts with "images/".
    let relPath = parsed.path;
    if (relPath.startsWith("images/")) relPath = relPath.slice("images/".length);
    const abs = path.join(sitePath, "images", relPath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return { ok: false, reason: "unresolved", message: `asset "${parsed.path}" not found on disk` };
    }
    const manifestEntry = siteIndex.assetManifest ? siteIndex.assetManifest[relPath] : null;
    const onDisk = siteIndex.assetsOnDisk.has(relPath);
    return {
      ok: true,
      kind: "asset",
      path: "images/" + relPath,
      hasManifestEntry: !!manifestEntry,
      onDisk,
    };
  }

  if (parsed.kind === "relative") {
    if (!hostRecord || !hostRecord.dataDir) {
      // direct-shape records have no defined "here" — markdown-only or sidecar lives in a parent dir,
      // but SPEC §5.5 specifically says markdown-only is invalid; for JSON-bearing records inside
      // sidecar/direct shape, the dataDir is undefined. We treat it as invalid for direct shape too:
      // refs in a sidecar JSON of a direct-shape record have no folder to resolve into.
      return { ok: false, reason: "relative_invalid", message: "relative ref used in a record without a containing folder" };
    }
    const abs = path.join(sitePath, hostRecord.dataDir, parsed.path);
    const inside = path.resolve(abs).startsWith(path.resolve(path.join(sitePath, hostRecord.dataDir)) + path.sep) ||
                   path.resolve(abs) === path.resolve(path.join(sitePath, hostRecord.dataDir, parsed.path));
    void inside;
    if (!fs.existsSync(abs)) {
      return { ok: false, reason: "unresolved", message: `relative path "${parsed.path}" does not exist` };
    }
    return { ok: true, kind: "relative", path: hostRecord.dataDir + "/" + parsed.path };
  }

  return { ok: false, reason: "unresolved", message: "unknown ref kind" };
}

// Try JSON path first, then markdown heading slug (SPEC §5.6).
function resolveSelector(selector, record) {
  // Try JSON dot-path.
  if (record.json) {
    const segs = selector.split(".");
    let cursor = record.json;
    let ok = true;
    for (const seg of segs) {
      if (cursor === null || cursor === undefined) {
        ok = false;
        break;
      }
      if (Array.isArray(cursor)) {
        if (/^[0-9]+$/.test(seg)) {
          const idx = parseInt(seg, 10);
          if (idx < 0 || idx >= cursor.length) {
            ok = false;
            break;
          }
          cursor = cursor[idx];
        } else {
          ok = false;
          break;
        }
      } else if (typeof cursor === "object") {
        if (!(seg in cursor)) {
          ok = false;
          break;
        }
        cursor = cursor[seg];
      } else {
        ok = false;
        break;
      }
    }
    if (ok) return { ok: true, value: cursor, via: "json" };
  }
  // Try markdown heading.
  if (record.headings && record.headings.length > 0) {
    const target = selector; // entire selector compared as a single slug
    for (const h of record.headings) {
      if (h.slug === target) {
        return { ok: true, value: h.text, via: "heading" };
      }
    }
  }
  return { ok: false };
}

function titleOf(record) {
  if (record.json && typeof record.json.title === "string" && record.json.title.length > 0) {
    return record.json.title;
  }
  if (record.h1) return record.h1;
  return record.slug ? record.slug : "";
}

module.exports = {
  looksLikeRef,
  parseRef,
  parseAddress,
  parseSelector,
  walkStringValues,
  resolveRef,
  resolveSelector,
  REF_PREFIXES,
};
