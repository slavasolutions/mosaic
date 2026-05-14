// runtime.js
//
// Importable from inside .astro files via:
//
//   import { getSingleton, getMessages } from '@mosaic/astro-loader/runtime';
//
// Re-exports the singleton helpers. The loader itself (`mosaicLoader`) is
// only useful from `content.config.ts`; runtime code should not touch it.

export {
  getSingleton,
  getSingletonData,
  getMessages,
  getPage,
  getRecord,
  getMosaicIndex,
  getManifest,
  renderMarkdown,
  readSiteFile,
} from './singleton.js';
