// loader.js
//
// Astro Content Collection loader for a Mosaic 0.8 collection.
//
// Astro's Content Loader API: a loader is `{ name, load({ store, parseData,
// generateDigest, logger, watcher? }) }`. Our `load()` reads the Mosaic
// folder, walks the requested collection, and writes one entry per record
// to the store.
//
// Each entry exposes:
//   id     — the record's slug
//   data   — the record's JSON merged with helper fields:
//              .body         raw markdown body (empty string when none)
//              .url          spec-computed URL or null when unrouted
//              .slug         the record's slug (same as id)
//              .mosaic       { shape, files } for tools that care
//            Any `asset:` refs at the top level are flattened from their
//            stub form back to a URL-ish string for schema compatibility
//            (see README "Image handling"). Everything else is left as-is.
//
// The loader is intentionally generic. It does not rename Mosaic fields to
// match any particular host schema. If a host schema needs `publishedAt`
// instead of `date`, that is the host's `content.config.ts` problem — the
// loader keeps Mosaic's vocabulary.

import fs from 'node:fs';
import path from 'node:path';
import { loadSite } from './load-site.js';

const ASSET_PREFIX = 'asset:';

/**
 * Build a Mosaic-backed Astro Content Loader for one collection.
 *
 * @param {object} opts
 * @param {string} opts.site         absolute path or path relative to the
 *                                   Astro project root to the Mosaic folder
 * @param {string} opts.collection   collection name (matches `collections/<name>` on disk)
 * @param {string} [opts.assetBase]  URL prefix to prepend to flattened asset
 *                                   refs. Defaults to "/". So `asset:images/x.jpg`
 *                                   becomes `/images/x.jpg`.
 */
export function mosaicLoader({ site, collection, assetBase = '/' } = {}) {
  if (!site) throw new Error('@mosaic/astro-loader: `site` is required');
  if (!collection) throw new Error('@mosaic/astro-loader: `collection` is required');

  return {
    name: '@mosaic/astro-loader',

    async load(ctx) {
      const { store, parseData, generateDigest, logger } = ctx;

      const sitePath = path.isAbsolute(site) ? site : path.resolve(process.cwd(), site);

      // Catch any FS race condition mid-walk (e.g. folder renamed away while
      // we're reading it). Treat as "folder gone" — clear the store, log, set
      // up the reappear poller, return. Without this, Astro's dev server
      // crashes on an unhandled ENOENT.
      let idx;
      try {
        idx = await loadSite(sitePath);
      } catch (e) {
        logger?.warn?.(`[mosaic:${collection}] site unreadable: ${e.message}`);
        // Drop the store; dependent pages will 404 cleanly until folder is back.
        for (const existingId of store.keys()) store.delete(existingId);
        // Set up the reappear poller (same logic as below, but for the
        // catastrophic-read-failure case where we never reached the bottom).
        if (ctx.watcher && !this._mosaicPollHandle) {
          const manifestPath = path.join(sitePath, 'mosaic.json');
          this._mosaicPollHandle = setInterval(() => {
            if (fs.existsSync(manifestPath)) {
              clearInterval(this._mosaicPollHandle);
              this._mosaicPollHandle = null;
              this.load(ctx).catch(() => {});
            }
          }, 2000);
        }
        return;
      }

      // Structural diagnostics: fail loud-ish but don't crash Astro — surface
      // through the logger and produce no entries. Astro will report the
      // empty collection downstream.
      const structural = (idx.diagnostics || []).filter((d) => d.severity === 'structural');
      if (structural.length > 0) {
        for (const d of structural) {
          logger?.error?.(`[mosaic:${collection}] ${d.code}: ${d.message} (${d.source})`);
        }
      }

      const col = idx.collections?.[collection];
      if (!col) {
        logger?.warn?.(`[mosaic:${collection}] collection not found in ${sitePath}`);
        store.clear();
        return;
      }

      const records = col.records || {};
      const keep = new Set();
      const defaultLocale = idx.site?.defaultLocale || idx.site?.locale || 'en';

      // MIP-0014: emit one Astro entry per (slug, locale) combination.
      //   - default-locale entry → id = "<slug>" (back-compat for sites
      //     that never declared multiple locales).
      //   - other-locale entry   → id = "<slug>--<locale>".
      // Consumers can filter via `getCollection('news', e => e.data.locale === 'uk')`
      // or look up by id directly. This keeps a single Zod schema valid
      // for every locale.
      for (const [slug, rec] of Object.entries(records)) {
        const localesForRec = rec.locales && rec.locales.length ? rec.locales : [defaultLocale];
        for (const locale of localesForRec) {
          const view = rec.localized?.[locale];
          const data = buildEntryData(rec, slug, locale, view, defaultLocale, { assetBase });
          const id = locale === defaultLocale ? slug : `${slug}--${locale}`;

          const parsed = parseData
            ? await parseData({ id, data })
            : data;

          const body = view?.body || '';
          const bodyHtml = view?.bodyHtml || '';
          const digest = generateDigest
            ? generateDigest({ id, data: parsed, body })
            : undefined;

          const entry = {
            id,
            data: parsed,
            digest,
            rendered: bodyHtml ? { html: bodyHtml, metadata: {} } : undefined,
          };
          if (body) entry.body = body;
          // Astro's store requires `filePath` to be project-relative;
          // Mosaic records live outside that root so we omit it.
          store.set(entry);
          keep.add(id);
        }
      }

      // Drop entries that disappeared from disk since last load — keeps the
      // store consistent across `astro dev` restarts.
      for (const existingId of store.keys()) {
        if (!keep.has(existingId)) store.delete(existingId);
      }

      // HMR: register the Mosaic folder with Astro's chokidar watcher (dev mode
      // only; ctx.watcher is undefined during `astro build`). Any add/change/
      // unlink under the folder re-invokes this.load(ctx).
      //
      // Edge cases covered:
      //   - In-folder edits: chokidar emits change/add/unlink → reload fires.
      //   - Folder fully removed: store empties (mosaic.json missing → loader
      //     warns + skips). We start a 2-second poller to detect re-creation.
      //   - Folder restored: poller's existence check passes → reload fires →
      //     poller clears itself.
      //   - Build mode: ctx.watcher is undefined; polling never starts; no-op.
      //   - Multiple loader instances (one per collection): each has its own
      //     poller, no interference.
      if (ctx.watcher) {
        if (!this._mosaicWatcherRegistered) {
          this._mosaicWatcherRegistered = true;
          // Add the watch path ONCE — calling ctx.watcher.add() on every load
          // causes chokidar to re-fire addDir for the just-re-added path,
          // which triggers reload, which re-adds, → V8 OOM.
          try { ctx.watcher.add(sitePath); } catch (_) {}

          // Debounce: a single `mv` emits ~50 chokidar events in <50ms.
          // Without debounce, each event triggers a full load(), stacking up
          // and exhausting heap. Collapse bursts into one reload after 300ms
          // of quiet.
          let reloadTimer = null;
          const reload = (p) => {
            if (typeof p === 'string' && !p.startsWith(sitePath)) return;
            if (reloadTimer) clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => {
              reloadTimer = null;
              this.load(ctx).catch((e) => {
                logger?.error?.(`[@mosaic/astro-loader] reload failed: ${e.message}`);
              });
            }, 300);
          };
          ctx.watcher.on('add', reload);
          ctx.watcher.on('addDir', reload);
          ctx.watcher.on('change', reload);
          ctx.watcher.on('unlink', reload);
          ctx.watcher.on('unlinkDir', reload);
        }

        // Folder-reappear poller. Chokidar drops the subscription when the
        // watched directory is removed; restoring the directory doesn't fire
        // any chokidar event because nothing is watching that path anymore.
        // Workaround: when we detect the folder is missing, set a low-rate
        // poll (every 2s) that checks for the manifest. On reappearance,
        // re-call load() and clear the poll.
        const manifestPath = path.join(sitePath, 'mosaic.json');
        const folderHere = fs.existsSync(manifestPath);
        if (!folderHere && !this._mosaicPollHandle) {
          this._mosaicPollHandle = setInterval(() => {
            if (fs.existsSync(manifestPath)) {
              clearInterval(this._mosaicPollHandle);
              this._mosaicPollHandle = null;
              this.load(ctx).catch((e) => {
                logger?.error?.(`[@mosaic/astro-loader] reload-after-restore failed: ${e.message}`);
              });
            }
          }, 2000);
        } else if (folderHere && this._mosaicPollHandle) {
          clearInterval(this._mosaicPollHandle);
          this._mosaicPollHandle = null;
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Internal: shape one record for the Astro store
// ---------------------------------------------------------------------------

function buildEntryData(rec, slug, locale, view, defaultLocale, { assetBase }) {
  // Use the locale-resolved view as the base so translatable fields,
  // per-locale JSON sidecars, and per-locale markdown bodies are all in
  // their final form before the schema sees them.
  const src = view && view.data && typeof view.data === 'object'
    ? view.data
    : (rec.data && typeof rec.data === 'object' ? rec.data : {});
  const data = { ...src };

  // Flatten any `asset:` refs back to URL strings. We walk one level deep
  // because Astro's `image()` validator runs at the top level of the schema
  // and ref-resolution would have replaced `"asset:images/x.jpg"` with a
  // `{ $asset, ... }` stub. We re-emit a string URL so schemas can stay
  // simple (`z.string()` / `z.string().url()`).
  flattenAssets(data, assetBase);

  // Helper fields — never overwrite an existing key.
  if (!('body' in data)) data.body = (view ? view.body : rec.body) || '';
  if (!('url' in data)) data.url = rec.url ?? null;
  if (!('slug' in data)) data.slug = slug;
  // MIP-0014: every entry carries its locale + the full list of locales
  // available for the record. Consumers route on data.locale.
  data.locale = locale;
  if (!('locales' in data)) data.locales = rec.locales || [defaultLocale];

  // Surface Mosaic record metadata under a single key so it stays out of the
  // way of user schemas.
  data.mosaic = {
    shape: rec.shape,
    files: rec.files || {},
    title: view ? view.title : rec.title,
    locale,
    defaultLocale,
  };

  return data;
}

function flattenAssets(obj, assetBase) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i];
      const flat = flattenOne(v, assetBase);
      if (flat !== undefined) obj[i] = flat;
      else flattenAssets(v, assetBase);
    }
    return;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const flat = flattenOne(v, assetBase);
    if (flat !== undefined) obj[k] = flat;
    else flattenAssets(v, assetBase);
  }
}

function flattenOne(v, assetBase) {
  if (v && typeof v === 'object' && typeof v.$asset === 'string') {
    return assetUrl(v.$asset, assetBase);
  }
  // Relative refs (`./image.jpg` co-located with a folder-shape record) get
  // emitted as `{ $rel, path }` stubs. Flatten image-like ones to URLs.
  if (v && typeof v === 'object' && typeof v.$rel === 'string' && typeof v.path === 'string') {
    if (/\.(jpe?g|png|gif|webp|svg|avif)$/i.test(v.path)) {
      // path is site-relative, e.g. "collections/news/<slug>/hero.jpg".
      // Emit a leading-slash URL so it works against the assetBase.
      const base = assetBase.endsWith('/') ? assetBase.slice(0, -1) : assetBase;
      return base + '/' + v.path;
    }
    return undefined;
  }
  if (typeof v === 'string' && v.startsWith(ASSET_PREFIX)) {
    // load-site.js should have replaced these already, but a string slipping
    // through is harmless to handle.
    return assetUrl(v.slice(ASSET_PREFIX.length), assetBase);
  }
  return undefined;
}

function assetUrl(relPath, assetBase) {
  // `$asset` values are like "images/hero.jpg". Strip a leading "images/" so
  // the result lands at <assetBase>/<rest>. Authors who want the literal
  // images/ prefix can pass assetBase: "/images/" and store paths without it.
  let p = relPath;
  if (p.startsWith('images/')) p = p.slice('images/'.length);
  const base = assetBase.endsWith('/') ? assetBase : assetBase + '/';
  return base + p;
}
