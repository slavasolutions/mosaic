"use strict";

// Resolve refs at render time.
//
// SPEC §5: Refs come in four forms (`ref:`, `asset:`, `./`, `@selector` suffix).
// The index stores stubs; the renderer needs URL + title (+ value for selectors)
// to actually produce HTML.
//
// All resolver functions defensively return `{ kind: "unresolved", original }`
// when something can't be resolved, so the page renderer can emit a
// <span class="mosaic-unresolved"> fallback rather than crashing.

const path = require("node:path");
const { extractMarkdownSection } = require("./markdown");

function isRefString(s) {
  if (typeof s !== "string") return false;
  return s.startsWith("ref:") || s.startsWith("asset:") || s.startsWith("./");
}

// Parse a ref string into { form, address, selector, raw }.
// Returns null if the string doesn't look like a ref.
function parseRef(raw) {
  if (typeof raw !== "string") return null;
  if (raw.startsWith("ref:")) {
    const body = raw.slice(4);
    const at = body.indexOf("@");
    const address = at >= 0 ? body.slice(0, at) : body;
    const selector = at >= 0 ? body.slice(at + 1) : null;
    return { form: "ref", address, selector, raw };
  }
  if (raw.startsWith("asset:")) {
    const body = raw.slice(6);
    return { form: "asset", address: body, selector: null, raw };
  }
  if (raw.startsWith("./")) {
    const body = raw.slice(2);
    const at = body.indexOf("@");
    const address = at >= 0 ? body.slice(0, at) : body;
    const selector = at >= 0 ? body.slice(at + 1) : null;
    return { form: "relative", address, selector, raw };
  }
  return null;
}

// Resolve a parsed ref against the index.
// `contextDir` is the absolute directory of the record's JSON file (for `./` form).
// Returns one of:
//   { kind: "record", record, url, title, addressKey, selector?, value? }
//   { kind: "asset",  assetPath, alt, width, height, mime, url }
//   { kind: "value",  value }                    (JSON-path selector that hits a primitive)
//   { kind: "markdown", html, title }            (markdown section selector)
//   { kind: "unresolved", original, reason }
function resolveRef(parsed, index, contextDir) {
  if (!parsed) return { kind: "unresolved", original: "", reason: "no ref" };

  if (parsed.form === "asset") {
    return resolveAsset(parsed.address, index);
  }

  if (parsed.form === "relative") {
    if (!contextDir) {
      return { kind: "unresolved", original: parsed.raw, reason: "no context dir" };
    }
    const abs = path.resolve(contextDir, parsed.address);
    // What kind of relative target? Markdown file → load + render section; image → asset-ish.
    const ext = path.extname(abs).toLowerCase();
    const rel = path.relative(index.siteRoot, abs).replace(/\\/g, "/");
    if (ext === ".md") {
      // Inline-render the (sub-)section.
      const fs = require("node:fs");
      let text;
      try {
        text = fs.readFileSync(abs, "utf8");
      } catch (_) {
        return { kind: "unresolved", original: parsed.raw, reason: "file missing" };
      }
      if (parsed.selector) {
        const slice = extractMarkdownSection(text, parsed.selector);
        if (slice === null) {
          return { kind: "unresolved", original: parsed.raw, reason: "selector missing" };
        }
        return { kind: "markdown", source: slice, title: parsed.selector };
      }
      return { kind: "markdown", source: text, title: rel };
    }
    if (ext === ".json") {
      const fs = require("node:fs");
      let text;
      try {
        text = fs.readFileSync(abs, "utf8");
      } catch (_) {
        return { kind: "unresolved", original: parsed.raw, reason: "file missing" };
      }
      try {
        const data = JSON.parse(text);
        if (parsed.selector) {
          const val = jsonPathGet(data, parsed.selector);
          if (val === undefined) {
            return { kind: "unresolved", original: parsed.raw, reason: "selector missing" };
          }
          return { kind: "value", value: val };
        }
        return { kind: "value", value: data };
      } catch (_) {
        return { kind: "unresolved", original: parsed.raw, reason: "bad json" };
      }
    }
    // Image or generic asset: build an asset-ish stub using on-disk presence.
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
    // singleton
    record = index.singletons[address];
    if (!record) {
      return { kind: "unresolved", original: parsed.raw, reason: "singleton missing" };
    }
  } else {
    collectionName = address.slice(0, slash);
    recordSlug = address.slice(slash + 1);
    const coll = index.collections[collectionName];
    if (!coll || !coll.records[recordSlug]) {
      return { kind: "unresolved", original: parsed.raw, reason: "record missing" };
    }
    record = coll.records[recordSlug];
  }

  if (parsed.selector) {
    // JSON path first.
    let val = jsonPathGet(record.data, parsed.selector);
    if (val !== undefined) {
      // DTCG-aware unwrapping per SPEC §10.3: when the selector lands on a
      // DTCG token leaf, the resolved value is the token's `$value`. Detect
      // by shape: an object with a `$value` key. Only unwrap for the `tokens`
      // singleton to avoid surprising authors who use `$value` as a key for
      // other purposes.
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
    // Markdown heading next.
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

function resolveAsset(rawPath, index) {
  // SPEC §5.4: `asset:images/...` paths. Tolerate either with or without
  // leading `images/` prefix.
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
  // We copy assets verbatim under <out>/images/<...> below. URL points there.
  return "/" + siteRelative.replace(/^\/+/, "");
}

// Walk a JSON-path selector: dot-segments; integer segments index arrays.
function jsonPathGet(obj, selector) {
  if (typeof selector !== "string" || !selector.length) return undefined;
  const segs = selector.split(".");
  let cur = obj;
  for (const seg of segs) {
    if (cur === null || cur === undefined) return undefined;
    if (/^\d+$/.test(seg) && Array.isArray(cur)) {
      const idx = Number(seg);
      cur = cur[idx];
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
  try {
    return require("node:fs").existsSync(p);
  } catch (_) {
    return false;
  }
}

module.exports = {
  isRefString,
  parseRef,
  resolveRef,
  resolveAsset,
  jsonPathGet,
};
