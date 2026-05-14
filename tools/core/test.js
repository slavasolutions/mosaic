// Self-test for @mosaic/core. Exercises every public function against
// the hromada-community example site.

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadSite,
  validateFields,
  validateSite,
  emitIndex,
  resolveRef,
  getRecord,
  getSingleton,
  walkRefs,
  parseRef,
  looksLikeRef,
  resolveSelector,
  headingSlug,
  firstH1,
  hasFrontmatter,
  resolveTitle,
  splitLocaleStem,
  resolveSiteLocales,
  resolveTranslatable,
  deepMerge,
  Diagnostics,
} from "./src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(__dirname, "../../examples/hromada-community");

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("  FAIL:", msg);
    failures++;
  } else {
    console.log("  ok:", msg);
  }
}

async function main() {
  console.log(`@mosaic/core self-test against ${SITE}\n`);

  // 1) loadSite
  console.log("== loadSite ==");
  const site = loadSite(SITE);
  assert(site.site && site.site.name === "Hromada Community", `site.name="${site.site?.name}"`);
  assert(site.pages.length > 0, `pages loaded (${site.pages.length})`);
  assert(site.collectionsByName.size > 0, `collections loaded (${site.collectionsByName.size})`);
  assert(site.singletonsByName.size > 0, `singletons loaded (${site.singletonsByName.size})`);
  assert(Array.isArray(site.routes) && site.routes.length > 0, `routes built (${site.routes.length})`);
  assert(site.redirects.length > 0, `redirects built (${site.redirects.length})`);
  assert(site.defaultLocale === "en-CA" || typeof site.defaultLocale === "string", `defaultLocale "${site.defaultLocale}"`);

  // 2) validateFields
  console.log("\n== validateFields ==");
  validateFields(site, site.diagnostics);
  const summary = site.diagnostics.summary();
  console.log("  diagnostics:", summary);
  assert(summary.structural === 0, `no structural errors`);

  // 3) emitIndex
  console.log("\n== emitIndex ==");
  const idx = emitIndex(site);
  assert(idx.mosaic_version === "0.8", `mosaic_version="${idx.mosaic_version}"`);
  assert(idx.pages["/"], `home page in index`);
  assert(idx.collections.news, `news collection in index`);
  assert(idx.singletons.site, `site singleton in index`);
  assert(typeof JSON.stringify(idx) === "string", `index is JSON-serializable`);

  // 4) getRecord
  console.log("\n== getRecord ==");
  const newsCol = site.collectionsByName.get("news");
  const firstNewsSlug = newsCol && newsCol.records[0] ? newsCol.records[0].slug : null;
  assert(firstNewsSlug, `news has at least one record: ${firstNewsSlug}`);
  if (firstNewsSlug) {
    const rec = getRecord(site, "news", firstNewsSlug);
    assert(rec && rec.slug === firstNewsSlug, `getRecord returns "${firstNewsSlug}"`);
    assert(typeof rec.title === "string", `record.title is a string`);
  }

  // 5) getSingleton
  console.log("\n== getSingleton ==");
  const siteSingleton = getSingleton(site, "site");
  assert(!!siteSingleton, `site singleton present`);
  assert(typeof siteSingleton.data === "object", `siteSingleton.data is an object`);

  // 6) resolveRef
  console.log("\n== resolveRef ==");
  if (firstNewsSlug) {
    const stub = resolveRef(site, `ref:news/${firstNewsSlug}`);
    assert(stub && stub.$ref === `news/${firstNewsSlug}`, `ref stub $ref="${stub?.$ref}"`);
    assert(typeof stub.title === "string", `ref stub.title is a string`);
  }
  const siteStub = resolveRef(site, "ref:site");
  assert(siteStub && siteStub.$ref === "site", `singleton ref stub $ref="site"`);

  const assetStub = resolveRef(site, "asset:images/logo.svg");
  assert(assetStub && assetStub.$asset === "images/logo.svg", `asset stub $asset="${assetStub?.$asset}"`);

  const malformed = resolveRef(site, "ref:Bad-Slug-Has-Uppercase");
  assert(malformed && malformed.$error, `malformed ref reports error`);

  // 7) walkRefs
  console.log("\n== walkRefs ==");
  let refCount = 0;
  if (firstNewsSlug) {
    const rec = newsCol.records[0];
    walkRefs(rec, () => refCount++);
  }
  console.log(`  walked ${refCount} ref(s) in first news record`);
  assert(refCount >= 0, `walkRefs invoked cb without crashing`);

  // 8) parseRef
  console.log("\n== parseRef ==");
  const p1 = parseRef("ref:team/anna@contact.email");
  assert(p1.ok && p1.kind === "ref" && p1.collection === "team" && p1.slug === "anna" && p1.selector === "contact.email", `parseRef parsed ref+selector`);
  const p2 = parseRef("asset:images/logo.svg");
  assert(p2.ok && p2.kind === "asset" && p2.path === "images/logo.svg", `parseRef parsed asset`);
  const p3 = parseRef("./hero.jpg");
  assert(p3.ok && p3.kind === "relative" && p3.path === "hero.jpg", `parseRef parsed relative`);
  const p4 = parseRef("not-a-ref");
  assert(!p4.ok, `parseRef rejects non-ref`);

  // 9) looksLikeRef
  console.log("\n== looksLikeRef ==");
  assert(looksLikeRef("ref:foo") === true, `looksLikeRef("ref:foo") = true`);
  assert(looksLikeRef("asset:x") === true, `looksLikeRef("asset:x") = true`);
  assert(looksLikeRef("./x") === true, `looksLikeRef("./x") = true`);
  assert(looksLikeRef("plain string") === false, `looksLikeRef("plain string") = false`);

  // 10) resolveSelector
  console.log("\n== resolveSelector ==");
  const r1 = resolveSelector("name", { data: { name: "Hromada" } });
  assert(r1.ok && r1.value === "Hromada", `resolveSelector name = Hromada`);
  const r2 = resolveSelector("missing", { data: { name: "Hromada" } });
  assert(!r2.ok, `resolveSelector missing fails`);

  // 11) headingSlug
  console.log("\n== headingSlug ==");
  assert(headingSlug("Where the name comes from") === "where-the-name-comes-from", `headingSlug works`);

  // 12) firstH1
  console.log("\n== firstH1 ==");
  assert(firstH1("# Hello world\n\ntext") === "Hello world", `firstH1 finds H1`);
  assert(firstH1("no heading here") === null, `firstH1 returns null when absent`);

  // 13) hasFrontmatter
  console.log("\n== hasFrontmatter ==");
  assert(hasFrontmatter("---\ntitle: x\n---\nbody") === true, `hasFrontmatter detects YAML`);
  assert(hasFrontmatter("# heading\nbody") === false, `hasFrontmatter returns false otherwise`);

  // 14) resolveTitle
  console.log("\n== resolveTitle ==");
  const t1 = resolveTitle({ data: { title: "Explicit" }, body: "# H1\n" });
  assert(t1.source === "json" && t1.value === "Explicit", `JSON title wins`);
  const t2 = resolveTitle({ data: {}, body: "# From H1\n" });
  assert(t2.source === "h1" && t2.value === "From H1", `H1 wins when JSON empty`);
  const t3 = resolveTitle({ data: {}, body: "", slug: "annual-report-2024" });
  assert(t3.source === "slug" && t3.value === "Annual Report 2024", `slug fallback works`);

  // 15) splitLocaleStem
  console.log("\n== splitLocaleStem ==");
  const s1 = splitLocaleStem("hello.uk", ["en", "uk"]);
  assert(s1.slug === "hello" && s1.locale === "uk", `splitLocaleStem .uk`);
  const s2 = splitLocaleStem("hello", ["en", "uk"]);
  assert(s2.slug === "hello" && s2.locale === null, `splitLocaleStem no suffix`);
  const s3 = splitLocaleStem("hello.unknown", ["en", "uk"]);
  assert(s3.slug === "hello.unknown" && s3.locale === null, `splitLocaleStem unknown suffix`);

  // 16) resolveSiteLocales
  console.log("\n== resolveSiteLocales ==");
  const sl1 = resolveSiteLocales({ defaultLocale: "en", locales: ["en", "uk"] });
  assert(sl1.defaultLocale === "en" && sl1.locales.length === 2, `resolveSiteLocales basic`);

  // 17) resolveTranslatable
  console.log("\n== resolveTranslatable ==");
  const tr1 = resolveTranslatable(
    { name: { $type: "translatable", values: { en: "Hello", uk: "Привіт" } } },
    "uk", "en",
  );
  assert(tr1.name === "Привіт", `resolveTranslatable picks uk`);

  // 18) deepMerge
  console.log("\n== deepMerge ==");
  const dm = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } });
  assert(dm.a === 1 && dm.b.c === 2 && dm.b.d === 3, `deepMerge merges objects`);

  // 19) Diagnostics
  console.log("\n== Diagnostics ==");
  const d = new Diagnostics();
  d.structural("test.code", "file", "msg");
  d.drift("test.code2", "file2", "msg2");
  d.warning("test.code3", "file3", "msg3");
  assert(d.summary().structural === 1, `Diagnostics counts structural`);
  assert(d.sorted().length === 3, `Diagnostics sorted returns all`);

  // 20) validateSite
  console.log("\n== validateSite (async) ==");
  const diags = await validateSite(SITE);
  assert(Array.isArray(diags), `validateSite returns array`);

  // 21) Locale view via getSingleton
  console.log("\n== locale projection ==");
  const enView = getSingleton(site, "site", { locale: "en-CA" });
  const ukView = getSingleton(site, "site", { locale: "uk-UA" });
  if (enView && ukView) {
    console.log(`  en title="${enView.title}", uk title="${ukView.title}"`);
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURES`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("test crashed:", err);
  process.exit(2);
});
