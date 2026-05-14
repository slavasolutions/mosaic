// @mosaic/astro-loader
//
// Public entry. Consumed from a user's `src/content.config.ts`:
//
//   import { defineCollection, z } from 'astro:content';
//   import { mosaicLoader } from '@mosaic/astro-loader';
//
//   const news = defineCollection({
//     loader: mosaicLoader({ site: '/abs/path/to/mosaic-site', collection: 'news' }),
//     schema: z.object({ title: z.string(), date: z.coerce.date(), /* ... */ }),
//   });
//
// Each Mosaic collection is exposed as one Astro collection. Singletons are
// not collections in Astro's model; reach for them via the `runtime` entry:
//
//   import { getSingleton } from '@mosaic/astro-loader/runtime';

export { mosaicLoader } from './loader.js';
export { loadSite } from './load-site.js';

// Re-export singleton helpers at the top level too — convenient for code
// that imports the package from a Node script rather than from a .astro
// file. The dedicated `/runtime` subpath stays the recommended entry for
// .astro use because it has zero loader-side dependencies.
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
