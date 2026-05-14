// @mosaic/core — shared Mosaic 0.8 SDK.
//
// Zero runtime dependencies beyond Node stdlib. ESM only. Pure functions
// wherever possible.

export { Diagnostics, SEV_STRUCTURAL, SEV_DRIFT, SEV_WARNING } from "./lib/diagnostics.js";

export {
  loadSite,
  emitIndex,
  resolveRef,
  getRecord,
  getSingleton,
} from "./lib/index.js";

export { validateFields, validateSite } from "./lib/validate.js";

export {
  parseRef,
  looksLikeRef,
  walkStringValues,
  walkRefs,
  resolveSelector,
  REF_PREFIXES,
} from "./lib/refs.js";

export {
  headingSlug,
  firstH1,
  allHeadings,
  hasFrontmatter,
  extractMarkdownSection,
  resolveTitle,
} from "./lib/markdown.js";

export {
  splitLocaleStem,
  resolveSiteLocales,
  resolveTranslatable,
  deepMerge,
  deepClone,
} from "./lib/locales.js";

export {
  SLUG_RE,
  RESERVED_ROOT,
  isReservedRootName,
  enumerateRecords,
  enumeratePageTree,
  locateSingleton,
  walkAssets,
  buildRecord,
  readDirSafe,
  readFileSafe,
  parseJSONSafe,
  relPath,
} from "./lib/walk.js";

export { loadManifest, validateManifestShape } from "./lib/manifest.js";
export { buildRoutes } from "./lib/routes.js";
