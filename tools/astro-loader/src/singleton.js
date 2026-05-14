// singleton.js
//
// Async helpers for Mosaic singletons and other root-level content that
// doesn't fit Astro's "collection of similarly-shaped records" model.
//
// Use from .astro files via the runtime entry:
//
//   import { getSingleton, getMessages } from '@mosaic/astro-loader/runtime';
//   const site = await getSingleton('/path/to/mosaic-site', 'site');
//
// Results are cached per-(site, name) for the lifetime of the Node process.
// A Mosaic folder doesn't change while a build runs, and `astro dev` spawns
// a fresh process on restart.

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { marked } from 'marked';
import { loadSite } from './load-site.js';

const siteCache = new Map();  // sitePath -> Promise<idx>

function resolveSite(site) {
  return path.isAbsolute(site) ? site : path.resolve(process.cwd(), site);
}

async function getSite(site) {
  const sitePath = resolveSite(site);
  if (!siteCache.has(sitePath)) {
    siteCache.set(sitePath, loadSite(sitePath));
  }
  return siteCache.get(sitePath);
}

/**
 * Read a singleton by name (e.g. "site", "header", "footer").
 * Returns the singleton record (with .data, .body, .bodyHtml, .title) or null.
 */
export async function getSingleton(site, name) {
  const idx = await getSite(site);
  return idx.singletons?.[name] || null;
}

/**
 * Convenience: read a singleton's JSON data and return it directly, or `{}`
 * if the singleton is missing.
 */
export async function getSingletonData(site, name) {
  const s = await getSingleton(site, name);
  return s?.data || {};
}

/**
 * Read messages.json (paraglide-style key/value translation bag).
 * Mosaic stores this as a free-form singleton named "messages".
 */
export async function getMessages(site) {
  return getSingletonData(site, 'messages');
}

/**
 * Read an arbitrary page from the Mosaic index (mapped by URL).
 */
export async function getPage(site, url) {
  const idx = await getSite(site);
  return idx.pages?.[url] || null;
}

/**
 * Read one collection record directly.
 */
export async function getRecord(site, collection, slug) {
  const idx = await getSite(site);
  return idx.collections?.[collection]?.records?.[slug] || null;
}

/**
 * Read the full index. Use sparingly — most callers should reach for the
 * narrower helpers above.
 */
export async function getMosaicIndex(site) {
  return getSite(site);
}

/**
 * Read the manifest object verbatim (mosaic.json contents).
 */
export async function getManifest(site) {
  const idx = await getSite(site);
  return idx.manifest;
}

/**
 * Render a raw markdown string to HTML using the same renderer the loader
 * uses for record bodies. Exposed so .astro pages can hand-render fields
 * that aren't first-class record bodies (e.g. a `summary` markdown blob on a
 * record).
 */
export function renderMarkdown(md) {
  if (typeof md !== 'string' || md === '') return '';
  try {
    return marked.parse(md, { mangle: false, headerIds: true });
  } catch {
    return md;
  }
}

/**
 * Read a raw file under the Mosaic site (rare — for tools that need direct
 * access). Path is relative to the site root.
 */
export async function readSiteFile(site, relPath) {
  const sitePath = resolveSite(site);
  const full = path.join(sitePath, relPath);
  return fs.readFile(full, 'utf8');
}
