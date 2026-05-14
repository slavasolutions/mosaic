// Standalone smoke test. Runs without Astro.
//
// Builds a minimal mock of Astro's loader context (store, parseData,
// generateDigest, logger) and verifies the loader populates the store with
// the expected shape for the migrated clear-ucc Mosaic site.
//
// Run:  node test.js

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mosaicLoader } from './src/index.js';
import { getSingleton, getMessages, getManifest } from './src/runtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE = '/home/ms/mosaic-clear-ucc-migrated';

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

  // 1) news — sidecar pair, schema-rich
  await testCollection('news', async (store, entries) => {
    const e = store.get('allies-of-steel');
    assert(!!e, 'allies-of-steel entry exists');
    assert(e.id === 'allies-of-steel', `id is "${e.id}"`);
    assert(typeof e.data.title === 'string' && e.data.title.length > 0, `title is "${e.data.title}"`);
    assert(typeof e.data.date === 'string', `date is "${e.data.date}"`);
    assert(e.data.slug === 'allies-of-steel', 'slug helper field present');
    assert('body' in e.data, 'body helper field present');
    assert(e.data.body.includes('Ground robotic platforms'), 'body contains markdown text');
    assert(e.body && e.body === e.data.body, 'entry.body mirrors data.body');
    assert(e.rendered?.html?.includes('<h2'), 'rendered.html present (pre-rendered)');
    assert(e.data.mosaic?.shape === 'pair', `mosaic.shape is "${e.data.mosaic?.shape}"`);
    assert(e.digest === 'digest-allies-of-steel', 'digest computed via generateDigest');
    assert(e.filePath?.endsWith('allies-of-steel.md'), `filePath set: ${e.filePath}`);
  });

  // 2) branches — JSON-only collection
  await testCollection('branches', async (store) => {
    const e = store.get('ucc-toronto');
    assert(!!e, 'ucc-toronto entry exists');
    assert(typeof e.data.name === 'string', `name is "${e.data.name}"`);
    assert(e.data.body === '', 'body is empty string for JSON-only records');
  });

  // 3) board — JSON-only
  await testCollection('board');

  // 4) trillium-recipients — JSON-only
  await testCollection('trillium-recipients');

  // 5) galleries — JSON-only
  await testCollection('galleries');

  // 6) idempotency: second load produces same entries
  console.log('\n== idempotency ==');
  const loader = mosaicLoader({ site: SITE, collection: 'news' });
  const ctx1 = mockCtx();
  const ctx2 = mockCtx();
  await loader.load(ctx1);
  await loader.load(ctx2);
  const keys1 = [...ctx1.store.keys()].sort();
  const keys2 = [...ctx2.store.keys()].sort();
  assert(JSON.stringify(keys1) === JSON.stringify(keys2), 'same key set across two loads');

  // 7) stale entry removed on rerun
  console.log('\n== stale-entry pruning ==');
  const sharedCtx = mockCtx();
  sharedCtx.store.set({ id: 'phantom', data: { stale: true }, digest: 'x' });
  await loader.load(sharedCtx);
  assert(!sharedCtx.store.get('phantom'), 'phantom entry pruned after load');

  // 8) singleton helpers
  console.log('\n== singletons ==');
  const header = await getSingleton(SITE, 'header');
  assert(!!header, 'header singleton loaded');
  assert(typeof header.data === 'object', 'header.data is an object');

  const footer = await getSingleton(SITE, 'footer');
  assert(!!footer, 'footer singleton loaded');

  const messages = await getMessages(SITE);
  assert(typeof messages === 'object', 'messages object returned');

  const manifest = await getManifest(SITE);
  assert(manifest?.version === '0.8', `manifest version is "${manifest?.version}"`);
  assert(manifest?.site?.name === 'uccon-website', `site name is "${manifest?.site?.name}"`);

  // 9) missing collection — clean failure
  console.log('\n== missing collection ==');
  const bogusLoader = mosaicLoader({ site: SITE, collection: 'does-not-exist' });
  const bogusCtx = mockCtx();
  await bogusLoader.load(bogusCtx);
  assert(bogusCtx.store.size() === 0, 'missing collection produces empty store');

  // 10) image flattening sanity (boards have no assets, but use a record
  //     whose JSON we control end-to-end: presidents has photo: "asset:..."
  //     if any, otherwise just inspect the news featured image is a URL)
  console.log('\n== asset flattening ==');
  const newsLoader = mosaicLoader({ site: SITE, collection: 'news' });
  const newsCtx = mockCtx();
  await newsLoader.load(newsCtx);
  const sample = [...newsCtx.store.values()][0];
  if (typeof sample.data.featuredImage === 'string') {
    assert(
      !sample.data.featuredImage.startsWith('asset:'),
      `featuredImage is plain string: ${sample.data.featuredImage}`,
    );
  } else if (sample.data.featuredImage && typeof sample.data.featuredImage === 'object') {
    assert(false, `featuredImage was not flattened: ${JSON.stringify(sample.data.featuredImage)}`);
  }

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURES`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('test crashed:', err);
  process.exit(2);
});
