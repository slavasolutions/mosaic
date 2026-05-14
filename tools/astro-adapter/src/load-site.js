// load-site.js
//
// Pure Node ESM loader that walks a Mosaic 0.8 folder and produces an
// in-memory index conforming to SPEC §7.1, with adapter extras:
//
//   - record.body holds raw markdown (per spec)
//   - record.bodyHtml holds pre-rendered HTML for convenience (adapter extra)
//
// The implementation deliberately re-implements §7.2 instead of importing
// the validator (which is CommonJS-only and oriented at CLI diagnostics).
// Cross-validation against `tools/validate/impl` is straightforward because
// both follow the same eight-step algorithm.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export async function loadSite(siteDir) {
  const root = path.resolve(siteDir);
  const ctx = newContext(root);

  await loadManifest(ctx);                   // §7.2 step 1
  if (hasStructural(ctx)) return finalize(ctx); // can't proceed without manifest

  await indexAssets(ctx);                    // step 2
  await indexSingletons(ctx);                // step 3
  await indexCollections(ctx);               // step 4
  await indexPages(ctx);                     // step 5
  buildRoutes(ctx);                          // step 6
  resolveRefs(ctx);                          // step 7

  return finalize(ctx);                      // step 8
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

function newContext(root) {
  return {
    root,
    manifest: null,
    site: { name: '', locale: undefined, url: undefined },
    pages: {},          // url -> page record
    collections: {},    // name -> { type, records: { slug -> record } }
    singletons: {},     // name -> record
    assets: {},         // path-under-images -> meta
    tokens: null,
    routes: {},         // url -> { kind, target }
    redirects: [],      // [{ from, to, status, source }]
    diagnostics: []
  };
}

function hasStructural(ctx) {
  return ctx.diagnostics.some((d) => d.severity === 'structural');
}

function diag(ctx, severity, code, message, source) {
  ctx.diagnostics.push({ severity, code, message, source });
}

// ---------------------------------------------------------------------------
// Step 1 — manifest
// ---------------------------------------------------------------------------

async function loadManifest(ctx) {
  const file = path.join(ctx.root, 'mosaic.json');
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    diag(ctx, 'structural', 'mosaic.config.invalid', 'mosaic.json not found', 'mosaic.json');
    return;
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    diag(ctx, 'structural', 'mosaic.config.invalid', `mosaic.json unparseable: ${err.message}`, 'mosaic.json');
    return;
  }
  if (!json || typeof json !== 'object') {
    diag(ctx, 'structural', 'mosaic.config.invalid', 'mosaic.json must be an object', 'mosaic.json');
    return;
  }
  ctx.manifest = json;
  ctx.site = { ...(json.site || { name: '' }) };
  if (!ctx.site.name) {
    diag(ctx, 'drift', 'mosaic.config.invalid', 'mosaic.json#site.name is required', 'mosaic.json');
  }
}

// ---------------------------------------------------------------------------
// Step 2 — assets
// ---------------------------------------------------------------------------

async function indexAssets(ctx) {
  const imgDir = path.join(ctx.root, 'images');
  if (!(await exists(imgDir))) return;

  // manifest first
  const manifestPath = path.join(imgDir, 'manifest.json');
  let manifest = {};
  if (await exists(manifestPath)) {
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch (err) {
      diag(ctx, 'drift', 'mosaic.config.invalid', `images/manifest.json unparseable: ${err.message}`, 'images/manifest.json');
      manifest = {};
    }
  }

  for (const [rel, meta] of Object.entries(manifest)) {
    ctx.assets[rel] = { ...meta };
  }

  // walk disk; flag unmanifested files
  for await (const file of walk(imgDir)) {
    const rel = path.relative(imgDir, file).split(path.sep).join('/');
    if (rel === 'manifest.json') continue;
    if (rel.startsWith('.') || rel.startsWith('_')) continue;
    if (!(rel in ctx.assets)) {
      diag(ctx, 'warning', 'mosaic.asset.unmanifested', `Asset on disk but not in manifest: images/${rel}`, `images/${rel}`);
      ctx.assets[rel] = {};
    }
  }
}

// ---------------------------------------------------------------------------
// Step 3 — singletons
// ---------------------------------------------------------------------------

async function indexSingletons(ctx) {
  const decls = ctx.manifest?.singletons || {};
  for (const [name, decl] of Object.entries(decls)) {
    if (RESERVED_ROOT_NAMES.has(name)) {
      diag(ctx, 'structural', 'mosaic.singleton.reserved',
        `Singleton "${name}" collides with a reserved root name`, 'mosaic.json');
      continue;
    }
    const rec = await loadRootRecord(ctx, name);
    if (!rec) {
      diag(ctx, 'structural', 'mosaic.singleton.missing',
        `Singleton "${name}" declared but no file at the site root`, 'mosaic.json');
      continue;
    }
    rec.type = decl?.type;
    ctx.singletons[name] = rec;
    if (name === 'tokens') {
      // tokens singleton — payload is the DTCG object directly
      ctx.tokens = rec.data || null;
    }
  }
  if (!ctx.tokens && ctx.manifest?.tokens) {
    ctx.tokens = ctx.manifest.tokens;
  }
}

const RESERVED_ROOT_NAMES = new Set([
  'mosaic.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md',
  'AGENTS.md', 'pages', 'collections', 'images'
]);

async function loadRootRecord(ctx, name) {
  const jsonPath = path.join(ctx.root, `${name}.json`);
  const mdPath = path.join(ctx.root, `${name}.md`);
  const hasJson = await exists(jsonPath);
  const hasMd = await exists(mdPath);
  if (!hasJson && !hasMd) return null;
  return buildRecord(ctx, {
    slug: name,
    shape: hasJson && hasMd ? 'pair' : hasJson ? 'json' : 'md',
    jsonPath: hasJson ? jsonPath : null,
    mdPath: hasMd ? mdPath : null,
    here: ctx.root
  });
}

// ---------------------------------------------------------------------------
// Step 4 — collections
// ---------------------------------------------------------------------------

async function indexCollections(ctx) {
  const colDir = path.join(ctx.root, 'collections');
  if (!(await exists(colDir))) return;
  const entries = await fs.readdir(colDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith('.') || ent.name.startsWith('_')) continue;
    const name = ent.name;
    const type = ctx.manifest?.collections?.[name]?.type;
    const records = await loadRecordsInDir(ctx, path.join(colDir, name), `collections/${name}`);
    ctx.collections[name] = { type, records };
  }
}

async function loadRecordsInDir(ctx, dir, relForDiag) {
  const out = {};
  const entries = await fs.readdir(dir, { withFileTypes: true });

  // group sibling .json + .md by stem
  const stems = new Map(); // stem -> { json, md }
  const folders = [];
  for (const ent of entries) {
    if (ent.name.startsWith('.') || ent.name.startsWith('_')) continue;
    if (ent.isDirectory()) {
      folders.push(ent.name);
      continue;
    }
    if (!ent.isFile()) continue;
    if (ent.name === 'index.md' || ent.name === 'index.json') continue; // §2.6
    const ext = path.extname(ent.name);
    const stem = path.basename(ent.name, ext);
    if (ext === '.json') {
      stems.set(stem, { ...(stems.get(stem) || {}), json: path.join(dir, ent.name) });
    } else if (ext === '.md') {
      stems.set(stem, { ...(stems.get(stem) || {}), md: path.join(dir, ent.name) });
    }
  }

  for (const [stem, sides] of stems.entries()) {
    if (!validSlug(stem)) {
      diag(ctx, 'structural', 'mosaic.slug.invalid',
        `Invalid slug "${stem}"`, `${relForDiag}/${stem}`);
      continue;
    }
    const lc = stem.toLowerCase();
    if (lc !== stem) {
      diag(ctx, 'structural', 'mosaic.slug.case',
        `Slug "${stem}" must be lowercase`, `${relForDiag}/${stem}`);
    }
    const rec = await buildRecord(ctx, {
      slug: stem,
      shape: sides.json && sides.md ? 'pair' : sides.json ? 'json' : 'md',
      jsonPath: sides.json || null,
      mdPath: sides.md || null,
      here: dir
    });
    out[stem] = rec;
  }

  for (const folder of folders) {
    if (!validSlug(folder)) {
      diag(ctx, 'structural', 'mosaic.slug.invalid',
        `Invalid slug "${folder}"`, `${relForDiag}/${folder}`);
      continue;
    }
    const fdir = path.join(dir, folder);
    const idxJson = path.join(fdir, 'index.json');
    const idxMd = path.join(fdir, 'index.md');
    const hasJson = await exists(idxJson);
    const hasMd = await exists(idxMd);
    if (!hasJson && !hasMd) {
      diag(ctx, 'structural', 'mosaic.record.empty',
        `Folder record "${folder}" has no index.md or index.json`, `${relForDiag}/${folder}`);
      continue;
    }
    const rec = await buildRecord(ctx, {
      slug: folder,
      shape: 'folder',
      jsonPath: hasJson ? idxJson : null,
      mdPath: hasMd ? idxMd : null,
      here: fdir
    });
    out[folder] = rec;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Step 5 — pages
// ---------------------------------------------------------------------------

async function indexPages(ctx) {
  const pagesDir = path.join(ctx.root, 'pages');
  if (!(await exists(pagesDir))) return;
  await indexPagesRecursive(ctx, pagesDir, '');
}

async function indexPagesRecursive(ctx, dir, urlPrefix) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const stems = new Map();
  const folders = [];
  for (const ent of entries) {
    if (ent.name.startsWith('.') || ent.name.startsWith('_')) continue;
    if (ent.isDirectory()) {
      folders.push(ent.name);
      continue;
    }
    if (!ent.isFile()) continue;
    if (urlPrefix === '' && (ent.name === 'home.md' || ent.name === 'home.json')) {
      diag(ctx, 'structural', 'mosaic.home.reserved',
        `pages/home.* is reserved; use pages/index.* for "/"`, `pages/${ent.name}`);
      continue;
    }
    const ext = path.extname(ent.name);
    const stem = path.basename(ent.name, ext);
    if (ext === '.json') {
      stems.set(stem, { ...(stems.get(stem) || {}), json: path.join(dir, ent.name) });
    } else if (ext === '.md') {
      stems.set(stem, { ...(stems.get(stem) || {}), md: path.join(dir, ent.name) });
    }
  }

  for (const [stem, sides] of stems.entries()) {
    if (stem !== 'index' && !validSlug(stem)) {
      diag(ctx, 'structural', 'mosaic.slug.invalid',
        `Invalid page slug "${stem}"`, `pages${urlPrefix}/${stem}`);
      continue;
    }
    let url;
    if (stem === 'index') {
      url = urlPrefix === '' ? '/' : urlPrefix;
    } else {
      url = `${urlPrefix}/${stem}`;
    }
    const rec = await buildRecord(ctx, {
      slug: stem,
      shape: sides.json && sides.md ? 'pair' : sides.json ? 'json' : 'md',
      jsonPath: sides.json || null,
      mdPath: sides.md || null,
      here: dir
    });
    rec.url = url;
    ctx.pages[url] = rec;
  }

  for (const folder of folders) {
    if (urlPrefix === '' && folder === 'home') {
      diag(ctx, 'structural', 'mosaic.home.reserved',
        `pages/home/ is reserved; use pages/index.* for "/"`, `pages/home`);
      continue;
    }
    if (!validSlug(folder)) {
      diag(ctx, 'structural', 'mosaic.slug.invalid',
        `Invalid page slug "${folder}"`, `pages${urlPrefix}/${folder}`);
      continue;
    }
    const fdir = path.join(dir, folder);
    const idxJson = path.join(fdir, 'index.json');
    const idxMd = path.join(fdir, 'index.md');
    const hasIdx = (await exists(idxJson)) || (await exists(idxMd));
    if (hasIdx) {
      const url = `${urlPrefix}/${folder}`;
      const rec = await buildRecord(ctx, {
        slug: folder,
        shape: 'folder',
        jsonPath: (await exists(idxJson)) ? idxJson : null,
        mdPath: (await exists(idxMd)) ? idxMd : null,
        here: fdir
      });
      rec.url = url;
      ctx.pages[url] = rec;
    }
    // nested pages
    await indexPagesRecursive(ctx, fdir, `${urlPrefix}/${folder}`);
  }
}

// ---------------------------------------------------------------------------
// Step 6 — routes
// ---------------------------------------------------------------------------

function buildRoutes(ctx) {
  // page routes first
  for (const [url, page] of Object.entries(ctx.pages)) {
    if (ctx.routes[url]) {
      diag(ctx, 'structural', 'mosaic.route.collision',
        `Two pages claim ${url}`, url);
      continue;
    }
    ctx.routes[url] = { kind: 'page', target: url };
  }

  // collection-list mounts → record routes
  for (const [pageUrl, page] of Object.entries(ctx.pages)) {
    const sections = page.data?.sections || [];
    for (const section of sections) {
      if (!section || section.type !== 'collection-list') continue;
      const fromPath = section.from || '';
      const m = /^collections\/([^/]+)$/.exec(fromPath);
      if (!m) {
        diag(ctx, 'structural', 'mosaic.collection.missing',
          `collection-list#from must be "collections/<name>", got "${fromPath}"`, pageUrl);
        continue;
      }
      const cname = m[1];
      const col = ctx.collections[cname];
      if (!col) {
        diag(ctx, 'structural', 'mosaic.collection.missing',
          `collection-list references missing collection "${cname}"`, pageUrl);
        continue;
      }
      if (section.routes === false) continue;
      const pattern = section.urlPattern || `${pageUrl === '/' ? '' : pageUrl}/{slug}`;
      for (const slug of Object.keys(col.records)) {
        const recUrl = pattern.replace('{slug}', slug);
        const existing = ctx.routes[recUrl];
        const target = `${cname}/${slug}`;
        if (existing) {
          if (existing.kind === 'record' && existing.target === target) {
            // identical mount, fine
          } else {
            diag(ctx, 'structural', 'mosaic.route.collision',
              `Route ${recUrl} claimed by multiple sources`, recUrl);
          }
          continue;
        }
        ctx.routes[recUrl] = { kind: 'record', target };
        col.records[slug].url = recUrl;
      }
    }
  }

  // unrouted collection records keep url = null (already so by default)

  // explicit redirects (manifest)
  const declared = ctx.manifest?.redirects || [];
  for (const r of declared) {
    addRedirect(ctx, r.from, r.to, r.status || 301, 'manifest');
  }
  // redirects singleton trumps manifest if present
  const redirSingleton = ctx.singletons.redirects;
  if (redirSingleton?.data?.rules) {
    if (declared.length > 0) {
      diag(ctx, 'warning', 'mosaic.redirect.duplicate-source',
        `Both mosaic.json#redirects and redirects singleton exist; singleton wins`, 'redirects.json');
    }
    // singleton wins; rebuild
    ctx.redirects = [];
    for (const r of redirSingleton.data.rules) {
      addRedirect(ctx, r.from, r.to, r.status || 301, 'singleton');
    }
  }

  // automatic /home → /
  if (!ctx.redirects.some((r) => r.from === '/home')) {
    addRedirect(ctx, '/home', '/', 301, 'auto');
  }

  // detect redirect collisions and loops. A "real route" is one whose kind
  // is page or record — the redirect's own entry in ctx.routes does not
  // count. The /home → / auto redirect is exempt (it points at a real
  // page route by spec design).
  const fromSet = new Map();
  for (const r of ctx.redirects) {
    const existing = ctx.routes[r.from];
    if (existing && existing.kind !== 'redirect' && r.source !== 'auto') {
      diag(ctx, 'structural', 'mosaic.redirect.collision',
        `Redirect from ${r.from} collides with a real route`, r.from);
    }
    fromSet.set(r.from, r.to);
  }
  for (const r of ctx.redirects) {
    if (followsLoop(fromSet, r.from)) {
      diag(ctx, 'structural', 'mosaic.redirect.loop',
        `Redirect chain starting at ${r.from} loops`, r.from);
    }
  }
}

function addRedirect(ctx, from, to, status, source) {
  ctx.redirects.push({ from, to, status, source });
  if (!ctx.routes[from]) {
    ctx.routes[from] = { kind: 'redirect', target: to };
  }
}

function followsLoop(map, start) {
  const seen = new Set();
  let cur = start;
  while (map.has(cur)) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = map.get(cur);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Step 7 — ref resolution
// ---------------------------------------------------------------------------

function resolveRefs(ctx) {
  for (const page of Object.values(ctx.pages)) {
    walkValues(page.data, (val, here) => maybeResolveRef(ctx, val, page, here), page.here);
  }
  for (const col of Object.values(ctx.collections)) {
    for (const rec of Object.values(col.records)) {
      walkValues(rec.data, (val, here) => maybeResolveRef(ctx, val, rec, here), rec.here);
    }
  }
  for (const rec of Object.values(ctx.singletons)) {
    walkValues(rec.data, (val, here) => maybeResolveRef(ctx, val, rec, here), rec.here);
  }
}

function maybeResolveRef(ctx, value, owner, here) {
  if (typeof value !== 'string') return value;
  if (value.startsWith('ref:')) return resolveRefStub(ctx, value.slice(4), 'ref');
  if (value.startsWith('asset:')) return resolveAssetStub(ctx, value.slice(6));
  if (value.startsWith('./')) {
    if (!here) {
      diag(ctx, 'structural', 'mosaic.relative.invalid',
        `Relative ref "${value}" in a record without a JSON file`, owner.slug);
      return value;
    }
    return resolveRelativeStub(ctx, value.slice(2), here);
  }
  return value;
}

function resolveRefStub(ctx, addrAndSel /* string */) {
  const [addr, selector] = splitSelector(addrAndSel);
  const slash = addr.indexOf('/');
  let target, url, title;
  if (slash < 0) {
    target = ctx.singletons[addr];
    title = target ? resolveTitle(target) : addr;
    url = null;
  } else {
    const cname = addr.slice(0, slash);
    const slug = addr.slice(slash + 1);
    const col = ctx.collections[cname];
    if (col && col.records[slug]) {
      target = col.records[slug];
      title = resolveTitle(target);
      url = target.url || null;
    } else {
      diag(ctx, 'drift', 'mosaic.ref.unresolved',
        `ref:${addr} does not resolve`, addr);
      title = slug || addr;
      url = null;
    }
  }
  const stub = { $ref: addr, url, title };
  if (selector) stub.selector = selector;
  return stub;
}

function resolveAssetStub(ctx, p) {
  // strip optional "images/" prefix that authors include
  let rel = p;
  if (rel.startsWith('images/')) rel = rel.slice(7);
  const meta = ctx.assets[rel];
  if (!meta) {
    diag(ctx, 'drift', 'mosaic.ref.unresolved',
      `asset:images/${rel} not found`, `images/${rel}`);
  }
  return {
    $asset: `images/${rel}`,
    ...(meta || {})
  };
}

function resolveRelativeStub(ctx, relPath, here) {
  const abs = path.resolve(here, relPath);
  const rel = path.relative(ctx.root, abs).split(path.sep).join('/');
  return { $rel: relPath, path: rel };
}

function splitSelector(s) {
  const i = s.indexOf('@');
  return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)];
}

function walkValues(node, fn, here) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const replaced = walkValues(node[i], fn, here);
      if (replaced !== undefined) node[i] = replaced;
    }
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const replaced = walkValues(node[k], fn, here);
      if (replaced !== undefined) node[k] = replaced;
    }
    return;
  }
  if (typeof node === 'string') {
    const out = fn(node, here);
    if (out !== node) return out;
  }
}

// ---------------------------------------------------------------------------
// Record construction
// ---------------------------------------------------------------------------

async function buildRecord(ctx, { slug, shape, jsonPath, mdPath, here }) {
  const rec = {
    shape,
    files: {},
    data: {},
    body: '',
    bodyHtml: '',
    slug,
    here
  };
  if (jsonPath) {
    const txt = await fs.readFile(jsonPath, 'utf8');
    try {
      rec.data = JSON.parse(txt);
    } catch (err) {
      diag(ctx, 'structural', 'mosaic.config.invalid',
        `JSON unparseable: ${err.message}`, path.relative(ctx.root, jsonPath));
      rec.data = {};
    }
    rec.files.json = path.relative(ctx.root, jsonPath);
  }
  if (mdPath) {
    const txt = await fs.readFile(mdPath, 'utf8');
    if (txt.startsWith('---')) {
      diag(ctx, 'structural', 'mosaic.frontmatter.present',
        `Markdown file has frontmatter; forbidden in 0.8`, path.relative(ctx.root, mdPath));
    }
    rec.body = txt;
    rec.bodyHtml = renderMarkdown(txt);
    rec.files.md = path.relative(ctx.root, mdPath);
  }
  rec.title = resolveTitle(rec);
  return rec;
}

function resolveTitle(rec) {
  if (rec?.data?.title && typeof rec.data.title === 'string') return rec.data.title;
  const h1 = firstH1(rec?.body || '');
  if (h1) return h1;
  return titleCaseSlug(rec?.slug || '');
}

function firstH1(md) {
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === '') continue;
    const m = /^#\s+(.+)$/.exec(line);
    return m ? m[1].trim() : null;
  }
  return null;
}

function titleCaseSlug(slug) {
  return slug.replace(/-+/g, ' ').replace(/\b([a-z0-9])/g, (s) => s.toUpperCase());
}

function renderMarkdown(md) {
  try {
    return marked.parse(md, { mangle: false, headerIds: true });
  } catch {
    return `<pre>${escapeHtml(md)}</pre>`;
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validSlug(s) {
  return /^[a-z0-9][a-z0-9-]*$/.test(s);
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name.startsWith('.') || ent.name.startsWith('_')) continue;
      yield* walk(full);
    } else if (ent.isFile()) {
      yield full;
    }
  }
}

// ---------------------------------------------------------------------------
// Finalize — strip internal helpers, freeze
// ---------------------------------------------------------------------------

function finalize(ctx) {
  // remove internal "here" pointers from emitted records (kept on the
  // adapter-side objects but should not leak into shared snapshots)
  const stripHere = (rec) => {
    if (!rec) return rec;
    const out = { ...rec };
    delete out.here;
    return out;
  };
  const pages = {};
  for (const [k, v] of Object.entries(ctx.pages)) pages[k] = stripHere(v);

  const collections = {};
  for (const [k, v] of Object.entries(ctx.collections)) {
    collections[k] = {
      type: v.type,
      records: Object.fromEntries(
        Object.entries(v.records).map(([s, r]) => [s, stripHere(r)])
      )
    };
  }
  const singletons = {};
  for (const [k, v] of Object.entries(ctx.singletons)) singletons[k] = stripHere(v);

  return {
    mosaic_version: ctx.manifest?.version || '0.8',
    site: ctx.site,
    manifest: ctx.manifest,
    pages,
    collections,
    singletons,
    assets: ctx.assets,
    tokens: ctx.tokens,
    routes: ctx.routes,
    redirects: ctx.redirects,
    diagnostics: ctx.diagnostics
  };
}
