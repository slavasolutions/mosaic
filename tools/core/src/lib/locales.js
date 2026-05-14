// MIP-0014 locale resolution helpers.
//
// Two orthogonal mechanisms:
//   1. Locale-suffix files: `<slug>.<locale>.{md,json}` siblings of `<slug>.{md,json}`.
//   2. Translatable fields: `{ $type: "translatable", values: { <locale>: <v> } }`.

// Split a filename stem into { slug, locale } per MIP-0014.
// If the trailing `.<segment>` isn't in `locales` (or its primary subtag),
// the whole stem is the slug.
export function splitLocaleStem(stem, locales) {
  if (!locales || locales.length === 0) return { slug: stem, locale: null };
  const idx = stem.lastIndexOf(".");
  if (idx <= 0) return { slug: stem, locale: null };
  const candidate = stem.slice(idx + 1);
  if (locales.includes(candidate)) {
    return { slug: stem.slice(0, idx), locale: candidate };
  }
  for (const l of locales) {
    const primary = String(l).split("-")[0];
    if (primary === candidate) return { slug: stem.slice(0, idx), locale: l };
  }
  return { slug: stem, locale: null };
}

// Compute defaultLocale + locales list given a manifest's site object.
// Always returns at least { defaultLocale: "en", locales: ["en"] }.
export function resolveSiteLocales(site) {
  const s = site || {};
  const declaredLocales = Array.isArray(s.locales) ? s.locales.slice() : [];
  const defaultLocale = s.defaultLocale || s.locale || (declaredLocales[0] || "en");
  if (!declaredLocales.includes(defaultLocale)) declaredLocales.unshift(defaultLocale);
  return { defaultLocale, locales: declaredLocales };
}

export function deepClone(v) {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(deepClone);
  const out = {};
  for (const k of Object.keys(v)) out[k] = deepClone(v[k]);
  return out;
}

// Deep-merge `overlay` on top of `base`. Objects merge recursively; arrays replace.
export function deepMerge(base, overlay) {
  if (overlay === null || overlay === undefined) return base;
  if (typeof overlay !== "object" || Array.isArray(overlay)) return overlay;
  if (base === null || typeof base !== "object" || Array.isArray(base)) return deepClone(overlay);
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) &&
        out[k] !== null && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = deepClone(v);
    }
  }
  return out;
}

// Walk a value tree; replace `{ $type: "translatable", values: {...} }` nodes
// with the value for `locale` (or fallback to defaultLocale, then any present
// value). `onMissing(pathKey)` is invoked for every fallback or missing entry.
export function resolveTranslatable(node, locale, defaultLocale, onMissing, pathKey = "") {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    return node.map((v, i) => resolveTranslatable(v, locale, defaultLocale, onMissing, `${pathKey}[${i}]`));
  }
  if (node.$type === "translatable" && node.values && typeof node.values === "object") {
    if (Object.prototype.hasOwnProperty.call(node.values, locale)) {
      return resolveTranslatable(node.values[locale], locale, defaultLocale, onMissing, pathKey);
    }
    if (Object.prototype.hasOwnProperty.call(node.values, defaultLocale)) {
      if (onMissing) onMissing(pathKey);
      return resolveTranslatable(node.values[defaultLocale], locale, defaultLocale, onMissing, pathKey);
    }
    const keys = Object.keys(node.values);
    if (keys.length) {
      if (onMissing) onMissing(pathKey);
      return resolveTranslatable(node.values[keys[0]], locale, defaultLocale, onMissing, pathKey);
    }
    if (onMissing) onMissing(pathKey);
    return null;
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = resolveTranslatable(v, locale, defaultLocale, onMissing, pathKey ? `${pathKey}.${k}` : k);
  }
  return out;
}
