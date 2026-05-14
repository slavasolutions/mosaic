// runtime.js
//
// Imported from inside .astro pages as:
//
//   import { getMosaicSite } from '@mosaic/astro-adapter/runtime';
//   const site = await getMosaicSite();
//
// The site object is supplied by a Vite virtual module that the
// integration sets up. We dynamic-import it so this file stays valid
// in any non-Astro context (e.g. when tools statically inspect the
// adapter package).

export async function getMosaicSite() {
  const mod = await import('virtual:mosaic-site');
  return mod.site || mod.default;
}

// Convenience helpers — purely sugar. The user's .astro page is free
// to ignore these and read `site` directly.

export async function getPage(url) {
  const site = await getMosaicSite();
  return site.pages[url] || null;
}

export async function getCollection(name) {
  const site = await getMosaicSite();
  const col = site.collections[name];
  if (!col) return [];
  return Object.values(col.records);
}

export async function getRecord(collection, slug) {
  const site = await getMosaicSite();
  return site.collections[collection]?.records?.[slug] || null;
}

export async function getSingleton(name) {
  const site = await getMosaicSite();
  return site.singletons[name] || null;
}

export async function getRoute(url) {
  const site = await getMosaicSite();
  return site.routes[url] || null;
}
