// Ref grammar parser per SPEC §5. Pure functions.
//
//   ref:<address>            singleton or <collection>/<slug>
//   asset:<images-path>
//   ./<rel-path>
//   any of the above + @<selector>
//
// Selector is dot-separated for JSON path; one heading-slug for markdown.

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const PATH_SEGMENT_RE = /^[A-Za-z0-9_.\-]+$/;
const SELECTOR_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;

export const REF_PREFIXES = ["ref:", "asset:", "./"];

export function looksLikeRef(s) {
  if (typeof s !== "string") return false;
  for (const p of REF_PREFIXES) if (s.startsWith(p)) return true;
  return false;
}

export function parseRef(s) {
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
      raw: s,
    };
  }

  if (s.startsWith("asset:")) {
    const rest = s.slice(6);
    if (rest.length === 0) return { ok: false, error: "empty asset path" };
    if (rest.indexOf("@") >= 0) return { ok: false, error: "asset refs MUST NOT carry selectors" };
    const segs = rest.split("/");
    for (const seg of segs) {
      if (!PATH_SEGMENT_RE.test(seg)) return { ok: false, error: `asset path segment "${seg}" invalid` };
    }
    return { ok: true, kind: "asset", path: rest, raw: s };
  }

  if (s.startsWith("./")) {
    const rest = s.slice(2);
    if (rest.length === 0) return { ok: false, error: "empty relative path" };
    const atIdx = rest.indexOf("@");
    const relPath = atIdx >= 0 ? rest.slice(0, atIdx) : rest;
    const selector = atIdx >= 0 ? rest.slice(atIdx + 1) : null;
    const segs = relPath.split("/");
    for (const seg of segs) {
      if (!PATH_SEGMENT_RE.test(seg)) return { ok: false, error: `relative path segment "${seg}" invalid` };
    }
    if (selector !== null) {
      const selParse = parseSelector(selector);
      if (!selParse.ok) return { ok: false, error: selParse.error };
    }
    return { ok: true, kind: "relative", path: relPath, selector, raw: s };
  }

  return { ok: false, error: "string is not a ref" };
}

function parseAddress(addr) {
  if (!addr || typeof addr !== "string") return { ok: false, error: "empty address" };
  const slashIdx = addr.indexOf("/");
  if (slashIdx < 0) {
    if (!NAME_RE.test(addr)) return { ok: false, error: `singleton name "${addr}" invalid` };
    return { ok: true, collection: null, slug: null, singleton: addr };
  }
  const collection = addr.slice(0, slashIdx);
  const slug = addr.slice(slashIdx + 1);
  if (!NAME_RE.test(collection)) return { ok: false, error: `collection name "${collection}" invalid` };
  if (!NAME_RE.test(slug)) return { ok: false, error: `slug "${slug}" invalid` };
  if (slug.indexOf("/") >= 0) return { ok: false, error: "address contains nested slash" };
  return { ok: true, collection, slug };
}

function parseSelector(sel) {
  if (!sel || typeof sel !== "string") return { ok: false, error: "empty selector" };
  const segs = sel.split(".");
  for (const seg of segs) {
    if (!SELECTOR_SEGMENT_RE.test(seg)) return { ok: false, error: `selector segment "${seg}" invalid` };
  }
  return { ok: true, segments: segs };
}

// Walk every string value in a JSON node. cb({ value, path }).
export function walkStringValues(node, cb, pathArr) {
  pathArr = pathArr || [];
  if (typeof node === "string") {
    cb({ value: node, path: pathArr.slice() });
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) walkStringValues(node[i], cb, pathArr.concat([i]));
    return;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) walkStringValues(node[k], cb, pathArr.concat([k]));
  }
}

// Walk every ref string in a record's JSON. cb(parsed, { value, path }) for each.
// Malformed refs surface via cb(parsed-with-ok-false).
export function walkRefs(record, cb) {
  if (!record || !record.data) return;
  walkStringValues(record.data, (visit) => {
    if (!looksLikeRef(visit.value)) return;
    const parsed = parseRef(visit.value);
    cb(parsed, visit);
  });
}

// Resolve a JSON-path or markdown-heading selector against a record.
// Returns { ok: true, value, via } or { ok: false }.
export function resolveSelector(selector, record) {
  // Try JSON dot-path first.
  const data = record.data || record.json;
  if (data) {
    const segs = selector.split(".");
    let cursor = data;
    let ok = true;
    for (const seg of segs) {
      if (cursor === null || cursor === undefined) { ok = false; break; }
      if (Array.isArray(cursor)) {
        if (/^[0-9]+$/.test(seg)) {
          const idx = parseInt(seg, 10);
          if (idx < 0 || idx >= cursor.length) { ok = false; break; }
          cursor = cursor[idx];
        } else { ok = false; break; }
      } else if (typeof cursor === "object") {
        if (!(seg in cursor)) { ok = false; break; }
        cursor = cursor[seg];
      } else { ok = false; break; }
    }
    if (ok) return { ok: true, value: cursor, via: "json" };
  }
  // Try markdown heading.
  const headings = record.headings;
  if (headings && headings.length > 0) {
    for (const h of headings) {
      if (h.slug === selector) return { ok: true, value: h.text, via: "heading" };
    }
  }
  return { ok: false };
}
