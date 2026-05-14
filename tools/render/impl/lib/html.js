// Tiny HTML helpers. No templating engine; just escaping + tag builders.

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// For attribute values where double quotes are the delimiter.
export function escapeAttr(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

// Build attributes string from { key: value } map. Skips null/undefined.
// Boolean true emits bare attribute; false skips.
export function attrs(map) {
  if (!map) return "";
  const parts = [];
  for (const key of Object.keys(map)) {
    const v = map[key];
    if (v === null || v === undefined || v === false) continue;
    if (v === true) {
      parts.push(key);
      continue;
    }
    parts.push(`${key}="${escapeAttr(v)}"`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

// Tagged template literal helper that escapes interpolated values by default.
// Use rawHtml(s) to opt out of escaping for already-safe HTML fragments.
const RAW = Symbol("raw");

export function rawHtml(str) {
  return { [RAW]: true, value: String(str) };
}

export function html(strings, ...values) {
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      out += renderValue(values[i]);
    }
  }
  return out;
}

function renderValue(v) {
  if (v === null || v === undefined || v === false) return "";
  if (Array.isArray(v)) return v.map(renderValue).join("");
  if (typeof v === "object" && v[RAW]) return v.value;
  return escapeHtml(v);
}

