// Standalone smoke test. Runs without Astro.
//
// Builds a minimal mock of Astro's loader context (store, parseData,
// generateDigest, logger) and verifies the loader populates the store with
// the expected shape for the in-repo hromada-community example site.
//
// Run:  node test.js

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mosaicLoader } from './src/index.js';
import { getSingleton, getManifest } from './src/runtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE = path.resolve(__dirname, '../../examples/hromada-community');

function mockStore() {
  const map = new Map();
  return {
    set: (entry) => map.set(entry.id, entry),
    delete: (id) => map.delete(id),
    keys: () => map.keys(),
    values: () => map.values(),
    get: (id) => map.get(id),
    clear: () => map.clear(),
    size: () => map.size,
  };
}

function mockCtx() {
  return {
    store: mockStore(),
    parseData: async ({ data }) => data,
    generateDigest: ({ id }) => `digest-${id}`,
    logger: {
      info: (m) => console.log('  [info]', m),
      warn: (m) => console.warn('  [warn]', m),
      error: (m) => console.error('  [error]', m),
    },
  };
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('  FAIL:', msg);
    failures++;
  } else {
    console.log('  ok:', msg);
  }
}

async function testCollection(name, expectations) {
  console.log(`\n== collection: ${name} ==`);
  const loader = mosaicLoader({ site: SITE, collection: name });
  const ctx = mockCtx();
  await loader.load(ctx);
  const entries = [...ctx.store.values()];
  assert(entries.length > 0, `loaded ${entries.length} entries`);
  if (expectations) await expectations(ctx.store, entries);
  return entries;
}

async function main() {
  console.log('Mosaic site:', SITE);

  // 1) news — folder-shape with markdown bodies
  await testCollection('news', async (store, entries) => {
    const e = store.get('2025-05-15-recap');
    assert(!!e, '2025-05-15-recap entry exists');
    assert(e.id === '2025-05-15-recap', `id is "${e.id}"`);
    assert(typeof e.data.mosaic?.title === 'string' && e.data.mosaic.title.length > 0, `resolved title is "${e.data.mosaic?.title}"`);
    assert(typeof e.data.date === 'string', `date is "${e.data.date}"`);
    assert(e.data.slug === '2025-05-15-recap', 'slug helper field present');
    assert('body' in e.data, 'body helper field present');
    assert(typeof e.data.body === 'string' && e.data.body.length > 0, 'body has content');
    assert(e.body && e.body === e.data.body, 'entry.body mirrors data.body');
    assert(e.rendered?.html?.length > 0, 'rendered.html present (pre-rendered)');
    assert(e.data.mosaic?.shape === 'folder', `mosaic.shape is "${e.data.mosaic?.shape}"`);
    assert(e.digest === 'digest-2025-05-15-recap', 'digest computed via generateDigest');
    assert(typeof e.data.url === 'string' || e.data.url === null, 'url helper field present');
    assert(e.data.locale && typeof e.data.locale === 'string', `locale helper "${e.data.locale}"`);
    assert(Array.isArray(e.data.locales) && e.data.locales.length > 0, 'locales array present');
  });

  // 2) team — folder-shape with image refs (asset flattening)
  await testCollection('team', async (store) => {
    const e = store.get('anna');
    assert(!!e, 'anna entry exists');
    assert(typeof e.data.role === 'string', `role is "${e.data.role}"`);
    // photo is an asset ref → loader should flatten to a URL string.
    if (e.data.photo !== undefined) {
      assert(
        typeof e.data.photo === 'string' && !e.data.photo.startsWith('asset:'),
        `photo flattened: ${typeof e.data.photo === 'string' ? e.data.photo : JSON.stringify(e.data.photo)}`,
      );
    }
  });

  // 3) services — JSON+md sidecar collection
  await testCollection('services', async (store) => {
    const e = store.get('language');
    assert(!!e, 'language service exists');
    assert(typeof e.data.title === 'string', `title is "${e.data.title}"`);
  });

  // 4) events — folder-shape, varied content
  await testCollection('events');

  // 5) idempotency: second load produces same entries
  console.log('\n== idempotency ==');
  const loader = mosaicLoader({ site: SITE, collection: 'news' });
  const ctx1 = mockCtx();
  const ctx2 = mockCtx();
  await loader.load(ctx1);
  await loader.load(ctx2);
  const keys1 = [...ctx1.store.keys()].sort();
  const keys2 = [...ctx2.store.keys()].sort();
  assert(JSON.stringify(keys1) === JSON.stringify(keys2), 'same key set across two loads');

  // 6) stale entry pruned on rerun
  console.log('\n== stale-entry pruning ==');
  const sharedCtx = mockCtx();
  sharedCtx.store.set({ id: 'phantom', data: { stale: true }, digest: 'x' });
  await loader.load(sharedCtx);
  assert(!sharedCtx.store.get('phantom'), 'phantom entry pruned after load');

  // 7) singleton helpers
  console.log('\n== singletons ==');
  const header = await getSingleton(SITE, 'header');
  assert(!!header, 'header singleton loaded');
  assert(typeof header.data === 'object', 'header.data is an object');

  const footer = await getSingleton(SITE, 'footer');
  assert(!!footer, 'footer singleton loaded');

  const siteSingleton = await getSingleton(SITE, 'site');
  assert(!!siteSingleton, 'site singleton loaded');

  const manifest = await getManifest(SITE);
  assert(manifest?.version === '0.8' || /^0\.8/.test(manifest?.version || ''), `manifest version starts with 0.8 ("${manifest?.version}")`);
  assert(typeof manifest?.site?.name === 'string', `site.name is "${manifest?.site?.name}"`);

  // 8) missing collection — clean failure
  console.log('\n== missing collection ==');
  const bogusLoader = mosaicLoader({ site: SITE, collection: 'does-not-exist' });
  const bogusCtx = mockCtx();
  await bogusLoader.load(bogusCtx);
  assert(bogusCtx.store.size() === 0, 'missing collection produces empty store');

  // 9) sample data shape sanity
  console.log('\n== sample data shape ==');
  const newsLoader = mosaicLoader({ site: SITE, collection: 'news' });
  const newsCtx = mockCtx();
  await newsLoader.load(newsCtx);
  const sample = [...newsCtx.store.values()][0];
  assert(sample && sample.id, 'sample entry has id');
  assert(sample.data, 'sample entry has data');
  assert(sample.data.mosaic && typeof sample.data.mosaic === 'object', 'sample.data.mosaic present');
  assert(typeof sample.data.mosaic.title === 'string', 'sample.data.mosaic.title is string');

  // 10) hero asset on a news record should be flattened (not remain as $asset stub)
  console.log('\n== asset flattening sanity ==');
  const recap = newsCtx.store.get('2025-05-15-recap');
  if (recap && recap.data.hero !== undefined) {
    if (typeof recap.data.hero === 'object') {
      assert(false, `hero was not flattened: ${JSON.stringify(recap.data.hero)}`);
    } else {
      assert(typeof recap.data.hero === 'string' && !recap.data.hero.startsWith('asset:'), `hero flattened: ${recap.data.hero}`);
    }
  }

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURES`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('test crashed:', err);
  process.exit(2);
});
