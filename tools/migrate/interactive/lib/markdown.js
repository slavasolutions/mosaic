"use strict";

// Normalize a date-like value (ISO string, JS Date, or human-readable like
// "Jul 08 2022") to YYYY-MM-DD. If parsing fails, return the input unchanged.
// Matches the helper in plan.js — kept inline here to keep this module
// stand-alone (markdown.js is also used by external callers).
function normalizeDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
    if (m) return m[1];
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return String(v);
}

// Frontmatter parser + sidecar split.
// Hand-rolled YAML lite — handles the cases we see in Astro markdown:
//   key: value
//   key: "quoted"
//   key: 'quoted'
//   key: 123
//   key: true|false|null
//   key: [a, b, c]   (inline array of scalars)
//   key:
//     - item
//     - item
//   key:
//     nested: value
// Anything we can't parse we leave as a raw string and report a warning.

const fs = require("node:fs");

function readMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return parseMarkdown(raw);
}

function parseMarkdown(raw) {
  // Detect frontmatter: starts with --- on its own line.
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== "---") {
    return { frontmatter: null, body: raw, warnings: [] };
  }
  // Find closing --- line.
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { frontmatter: null, body: raw, warnings: ["unterminated-frontmatter"] };
  }
  const fmLines = lines.slice(1, end);
  const bodyLines = lines.slice(end + 1);
  // Strip a single leading blank line from body for cleanliness.
  while (bodyLines.length && bodyLines[0].trim() === "") bodyLines.shift();
  const body = bodyLines.join("\n");

  const parsed = parseYamlLite(fmLines);
  return { frontmatter: parsed.data, body, warnings: parsed.warnings };
}

function parseYamlLite(lines) {
  const warnings = [];
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) { i++; continue; }
    const indent = line.match(/^ */)[0].length;
    if (indent !== 0) {
      warnings.push(`unexpected-indent-at-line-${i + 1}`);
      i++;
      continue;
    }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) {
      warnings.push(`unparseable-line-${i + 1}: ${line}`);
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2];
    if (rest === "") {
      // Block scalar/array/object follows.
      const block = collectBlock(lines, i + 1);
      i = block.endIndex;
      const parsed = parseBlock(block.lines, warnings);
      data[key] = parsed;
    } else {
      data[key] = parseScalar(rest, warnings);
      i++;
    }
  }
  return { data, warnings };
}

function collectBlock(lines, startIdx) {
  const collected = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { collected.push(line); i++; continue; }
    if (/^\S/.test(line)) break;
    collected.push(line);
    i++;
  }
  // Trim trailing blank lines.
  while (collected.length && collected[collected.length - 1].trim() === "") collected.pop();
  return { lines: collected, endIndex: i };
}

function parseBlock(blockLines, warnings) {
  // Detect: list (starts with `-`) or map (key: ...) at the common indent.
  const nonblank = blockLines.filter((l) => l.trim() !== "");
  if (nonblank.length === 0) return null;
  const baseIndent = nonblank[0].match(/^ */)[0].length;
  const firstTrim = nonblank[0].slice(baseIndent);
  if (firstTrim.startsWith("- ") || firstTrim === "-") {
    const items = [];
    let i = 0;
    while (i < blockLines.length) {
      const line = blockLines[i];
      if (line.trim() === "") { i++; continue; }
      const indent = line.match(/^ */)[0].length;
      if (indent !== baseIndent || !line.slice(baseIndent).startsWith("-")) break;
      const after = line.slice(baseIndent + 1).replace(/^ /, "");
      if (after === "") {
        // Block item: collect next indented lines as a sub-block.
        const sub = collectBlock(blockLines, i + 1);
        items.push(parseBlock(sub.lines, warnings));
        i = sub.endIndex;
      } else {
        items.push(parseScalar(after, warnings));
        i++;
      }
    }
    return items;
  }
  // Map block.
  const map = {};
  let i = 0;
  while (i < blockLines.length) {
    const line = blockLines[i];
    if (line.trim() === "") { i++; continue; }
    const indent = line.match(/^ */)[0].length;
    if (indent !== baseIndent) break;
    const m = line.slice(baseIndent).match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) { warnings.push(`unparseable-block-line: ${line}`); i++; continue; }
    const key = m[1];
    const rest = m[2];
    if (rest === "") {
      const sub = collectBlock(blockLines, i + 1);
      map[key] = parseBlock(sub.lines, warnings);
      i = sub.endIndex;
    } else {
      map[key] = parseScalar(rest, warnings);
      i++;
    }
  }
  return map;
}

function parseScalar(raw, warnings) {
  const v = raw.trim();
  if (v === "") return "";
  if (v === "null" || v === "~") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  // Quoted string.
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  // Inline array.
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => parseScalar(s.trim(), warnings));
  }
  // Inline object.
  if (v.startsWith("{") && v.endsWith("}")) {
    const inner = v.slice(1, -1).trim();
    if (inner === "") return {};
    const obj = {};
    inner.split(",").forEach((pair) => {
      const kv = pair.split(":");
      if (kv.length >= 2) {
        const k = kv[0].trim().replace(/^["']|["']$/g, "");
        obj[k] = parseScalar(kv.slice(1).join(":").trim(), warnings);
      }
    });
    return obj;
  }
  // Number.
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
  // ISO-ish date — keep as string; Mosaic stores dates as strings.
  return v;
}

// Split a record with frontmatter into (jsonFields, markdownBody).
// Frontmatter keys become record JSON fields; engine-only metadata
// (lang/locale, slug, raw timestamps) goes under $astro per MIP-0009.
function splitFrontmatterToSidecar(frontmatter, body, opts = {}) {
  const fm = frontmatter || {};
  const json = {};
  const astroExtras = {};

  // Keys that never make sense at the Mosaic record level — slug is the
  // filename, lang/locale is a site-level concern in 0.8.
  const stash = new Set(["slug", "lang", "locale"]);

  for (const [k, v] of Object.entries(fm)) {
    if (stash.has(k)) {
      astroExtras[k] = v;
      continue;
    }
    json[k] = v;
  }

  // Normalize Astro date keys onto `date`. Keep originals out of the record
  // (they survive under $astro for the engine).
  if (fm.publishedAt && !json.date) {
    json.date = normalizeDate(fm.publishedAt);
    delete json.publishedAt;
    astroExtras.publishedAt = fm.publishedAt;
  }
  if (fm.pubDate && !json.date) {
    json.date = normalizeDate(fm.pubDate);
    delete json.pubDate;
    astroExtras.pubDate = fm.pubDate;
  }

  if (Object.keys(astroExtras).length) {
    json["$astro"] = astroExtras;
  }

  return { json, body };
}

module.exports = { readMarkdown, parseMarkdown, splitFrontmatterToSidecar };
