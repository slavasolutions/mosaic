// Resolve refs at render time.
//
// SPEC §5. The index stores stubs; the renderer needs URL + title (+ value for
// selectors) to actually produce HTML. Ref parsing and grammar live in
// @mosaic/core; this module wraps them with renderer-specific dispatch.

import fs from "node:fs";
import path from "node:path";

import { looksLikeRef, parseRef as coreParseRef } from "../../../core/src/index.js";
import { extractMarkdownSection } from "./markdown.js";

export function isRefString(s) {
  return looksLikeRef(s);
}

// Parse a ref string into { form, address, selector, raw } using the renderer's
// historical field names (so render-page.js keeps working unchanged).
export function parseRef(raw) {
  if (typeof raw !== "string") return null;
  const r = coreParseRef(raw);
  if (!r.ok) return null;
  if (r.kind === "ref") {
    return { form: "ref", address: r.address, selector: r.selector, raw };
  }
  if (r.kind === "asset") {
    return { form: "asset", address: r.path, selector: null, raw };
  }
  if (r.kind === "relative") {
    return { form: "relative", address: r.path, selector: r.selector, raw };
  }
  return null;
}

// Resolve a parsed ref against the index. Returns:
//   { kind: "record",     record, url, title, addressKey, selector?, value? }
//   { kind: "asset",      assetPath, alt, width, height, mime, url, onDisk }
//   { kind: "value",      value, [record, url, title] }
//   { kind: "markdown",   source, title, [record, url] }
//   { kind: "unresolved", original, reason }
export function resolveRef(parsed, index, contextDir) {
  if (!parsed) return { kind: "unresolved", original: "", reason: "no ref" };

  if (parsed.form === "asset") return resolveAsset(parsed.address, index);

  if (parsed.form === "relative") {
    if (!contextDir) return { kind: "unresolved", original: parsed.raw, reason: "no context dir" };
    const abs = path.resolve(contextDir, parsed.address);
    const ext = path.extname(abs).toLowerCase();
    const rel = path.relative(index.siteRoot, abs).replace(/\\/g, "/");
    if (ext === ".md") {
      let text;
      try { text = fs.readFileSync(abs, "utf8"); }
      catch { return { kind: "unresolved", original: parsed.raw, reason: "file missing" }; }
      if (parsed.selector) {
        const slice = extractMarkdownSection(text, parsed.selector);
        if (slice === null) return { kind: "unresolved", original: parsed.raw, reason: "selector missing" };
        return { kind: "markdown", source: slice, title: parsed.selector };
      }
      return { kind: "markdown", source: text, title: rel };
    }
    if (ext === ".json") {
      let text;
      try { text = fs.readFileSync(abs, "utf8"); }
      catch { return { kind: "unresolved", original: parsed.raw, reason: "file missing" }; }
      try {
        const data = JSON.parse(text);
        if (parsed.selector) {
          const val = jsonPathGet(data, parsed.selector);
          if (val === undefined) return { kind: "unresolved", original: parsed.raw, reason: "selector missing" };
          return { kind: "value", value: val };
        }
        return { kind: "value", value: data };
      } catch { return { kind: "unresolved", original: parsed.raw, reason: "bad json" }; }
    }
    return {
      kind: "asset",
      assetPath: rel,
      url: relativeAssetUrl(rel),
      alt: "",
      width: null,
      height: null,
      mime: null,
      onDisk: fileExists(abs),
    };
  }

  // ref: form
  const address = parsed.address;
  const slash = address.indexOf("/");
  let record = null;
  let collectionName = null;
  let recordSlug = null;
  if (slash === -1) {
    record = index.singletons[address];
    if (!record) return { kind: "unresolved", original: parsed.raw, reason: "singleton missing" };
  } else {
    collectionName = address.slice(0, slash);
    recordSlug = address.slice(slash + 1);
    const coll = index.collections[collectionName];
    if (!coll || !coll.records[recordSlug]) return { kind: "unresolved", original: parsed.raw, reason: "record missing" };
    record = coll.records[recordSlug];
  }

  if (parsed.selector) {
    let val = jsonPathGet(record.data, parsed.selector);
    if (val !== undefined) {
      // DTCG token unwrap for the tokens singleton.
      if (
        address === "tokens" &&
        val &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        Object.prototype.hasOwnProperty.call(val, "$value")
      ) {
        val = val.$value;
      }
      return {
        kind: "value",
        value: val,
        record,
        url: record.url || null,
        title: record.title,
      };
    }
    if (record.body) {
      const slice = extractMarkdownSection(record.body, parsed.selector);
      if (slice !== null) {
        return {
          kind: "markdown",
          source: slice,
          title: record.title,
          record,
          url: record.url || null,
        };
      }
    }
    return { kind: "unresolved", original: parsed.raw, reason: "selector missing" };
  }

  return {
    kind: "record",
    record,
    url: record.url || null,
    title: record.title,
    addressKey: address,
  };
}

export function resolveAsset(rawPath, index) {
  let assetKey = rawPath;
  if (assetKey.startsWith("images/")) assetKey = assetKey.slice("images/".length);
  const meta = index.assetsManifest[assetKey] || {};
  const onDisk = !!index.assets[assetKey];
  const url = relativeAssetUrl("images/" + assetKey);
  return {
    kind: "asset",
    assetPath: "images/" + assetKey,
    url,
    alt: typeof meta.alt === "string" ? meta.alt : "",
    width: typeof meta.width === "number" ? meta.width : null,
    height: typeof meta.height === "number" ? meta.height : null,
    mime: typeof meta.mime === "string" ? meta.mime : null,
    onDisk,
  };
}

function relativeAssetUrl(siteRelative) {
  return "/" + siteRelative.replace(/^\/+/, "");
}

export function jsonPathGet(obj, selector) {
  if (typeof selector !== "string" || !selector.length) return undefined;
  const segs = selector.split(".");
  let cur = obj;
  for (const seg of segs) {
    if (cur === null || cur === undefined) return undefined;
    if (/^\d+$/.test(seg) && Array.isArray(cur)) {
      cur = cur[Number(seg)];
      continue;
    }
    if (typeof cur === "object") {
      cur = cur[seg];
      continue;
    }
    return undefined;
  }
  return cur;
}

function fileExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}
