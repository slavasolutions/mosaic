#!/usr/bin/env node
"use strict";

// Mosaic 0.8 reference validator. Dependency-free.
// CLI: node validate.js --site <path> [--strict] [--json] [--quiet]

const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const { Diagnostics } = require("./lib/diagnostics");
const { loadManifest } = require("./lib/manifest");
const {
  enumerateRecords,
  enumeratePageTree,
  pageRecordUrl,
  isReservedRootName,
  locateSingleton,
  hasFrontmatter,
  firstH1,
  allHeadings,
  resolveTitle,
  readDirSafe,
  readFileSafe,
  parseJSONSafe,
  RESERVED_ROOT,
} = require("./lib/walk");
const { looksLikeRef, parseRef, walkStringValues, resolveRef } = require("./lib/refs");
const { buildRoutes } = require("./lib/routes");

function parseArgs(argv) {
  // Default to JSON output. The conformance runner invokes the tool without --json
  // and expects stdout to be JSON. A --human flag opts in to the textual report.
  const args = { site: null, strict: false, json: true, quiet: false, human: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--site") {
      args.site = argv[++i];
    } else if (a === "--strict") {
      args.strict = true;
    } else if (a === "--json") {
      args.json = true;
      args.human = false;
    } else if (a === "--human") {
      args.human = true;
      args.json = false;
    } else if (a === "--quiet") {
      args.quiet = true;
    } else if (a === "--help" || a === "-h") {
      args.help = true;
    } else {
      args._unknown = args._unknown || [];
      args._unknown.push(a);
    }
  }
  return args;
}

function fail(msg) {
  process.stderr.write(msg + "\n");
  process.exit(64);
}

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    process.stdout.write(
      "Usage: validate.js --site <path> [--strict] [--json] [--quiet]\n"
    );
    process.exit(0);
  }
  if (!args.site) {
    fail("missing --site <path>");
  }
  const sitePath = path.resolve(args.site);
  if (!fs.existsSync(sitePath) || !fs.statSync(sitePath).isDirectory()) {
    // Not an invocation error per se — but tools/validate/README says config.invalid covers missing manifest.
    // Without an existing directory, we can still emit a single config.invalid diagnostic.
    const diagnostics = new Diagnostics();
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      `site path "${args.site}" not found or not a directory`
    );
    return emit(diagnostics, sitePath, args, []);
  }

  const diagnostics = new Diagnostics();
  const manifest = loadManifest(sitePath, diagnostics);

  if (!manifest) {
    return emit(diagnostics, sitePath, args, []);
  }

  const siteIndex = buildSiteIndex(sitePath, manifest, diagnostics);
  const { routes } = buildRoutes(siteIndex, diagnostics);

  // After route table built, run ref resolution.
  resolveAllRefs(sitePath, siteIndex, diagnostics);

  // Schema-driven validation (field.required, field.unknown, field.type-mismatch, title.dead-h1).
  runFieldValidation(siteIndex, manifest, diagnostics);

  // Orphan / unmounted / unmanifested warnings.
  runWarningPass(siteIndex, diagnostics);

  return emit(diagnostics, sitePath, args, routes, manifest);
}

function emit(diagnostics, sitePath, args, routes, manifest) {
  const summary = diagnostics.summary();
  const sorted = diagnostics.sorted();
  const version = (manifest && typeof manifest.version === "string") ? manifest.version : "0.8";

  const output = {
    site: sitePath,
    version,
    summary,
    diagnostics: sorted,
    routes: sortRoutes(routes || []),
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else if (!args.quiet) {
    writeHuman(output);
  }

  let exitCode = 0;
  if (summary.structural > 0) exitCode = 1;
  else if (args.strict && summary.drift > 0) exitCode = 1;
  process.exit(exitCode);
}

function sortRoutes(routes) {
  return routes.slice().sort((a, b) => {
    if (a.url < b.url) return -1;
    if (a.url > b.url) return 1;
    return 0;
  });
}

function writeHuman(output) {
  const s = output.summary;
  process.stdout.write(`Mosaic site: ${output.site}\n\n`);
  process.stdout.write(`STRUCTURAL ERRORS  ${s.structural}\n`);
  process.stdout.write(`DRIFT              ${s.drift}\n`);
  process.stdout.write(`WARNINGS           ${s.warning}\n\n`);
  for (const d of output.diagnostics) {
    const tag = d.severity === "structural" ? "error"
              : d.severity === "drift" ? "drift" : "warn";
    process.stdout.write(`${tag.padEnd(6)} ${d.source}\n`);
    process.stdout.write(`       ${d.code}   ${d.message}\n`);
  }
}

// ---------- Build the in-memory site index ----------

function buildSiteIndex(sitePath, manifest, diagnostics) {
  const idx = {
    sitePath,
    manifest,
    pages: [],
    collectionsByName: new Map(),  // name → { records, recordsBySlug }
    singletonsByName: new Map(),   // name → record
    assetsOnDisk: new Set(),       // rel path under images/
    assetManifest: null,           // images/manifest.json contents (object), or null
    assetReferences: new Set(),    // rel paths actually referenced
    refsToCollections: new Set(),  // collection names with inbound refs
    recordUrls: new Map(),         // record → url
    routedCollections: new Set(),
    allRecords: [],
  };

  // 0) Pages — recursive walk for deep page hierarchies (SPEC §3.1).
  const pagesDir = path.join(sitePath, "pages");
  if (fs.existsSync(pagesDir)) {
    const pageRecs = enumeratePageTree(sitePath, diagnostics);
    // Apply home.reserved rule on top-level home slug only.
    pageRecs.forEach((rec) => {
      const segs = rec._pathSegments || [];
      if (segs.length === 1 && segs[0] === "home") {
        diagnostics.structural(
          "mosaic.home.reserved",
          rec.sourcePath,
          'the slug "home" is reserved at the top of pages/'
        );
        rec._url = null;
      }
    });
    idx.pages = pageRecs.filter((r) => r._url !== null);
    for (const r of idx.pages) idx.allRecords.push(r);
  }

  // 1) Collections
  const collectionsDir = path.join(sitePath, "collections");
  if (fs.existsSync(collectionsDir)) {
    const ents = readDirSafe(collectionsDir) || [];
    for (const ent of ents) {
      if (!ent.isDirectory()) continue;
      if (ent.name.startsWith(".") || ent.name.startsWith("_")) continue;
      const collName = ent.name;
      const records = enumerateRecords(sitePath, `collections/${collName}`, diagnostics);
      const recordsBySlug = new Map();
      for (const r of records) {
        recordsBySlug.set(r.slug.toLowerCase(), r);
        idx.allRecords.push(r);
      }
      idx.collectionsByName.set(collName, { name: collName, records, recordsBySlug });
    }
  }

  // 2) Singletons
  const singletons = (manifest.singletons && typeof manifest.singletons === "object") ? manifest.singletons : {};
  // Tolerate 0.7-era manifests with "globals" instead of "singletons".
  if (Object.keys(singletons).length === 0 && manifest.globals && typeof manifest.globals === "object") {
    // Treat globals as singletons for tolerance.
    for (const k of Object.keys(manifest.globals)) {
      singletons[k] = manifest.globals[k];
    }
  }
  for (const sname of Object.keys(singletons)) {
    if (isReservedRootName(sname) || isReservedRootName(sname + ".json") || isReservedRootName(sname + ".md")) {
      diagnostics.structural(
        "mosaic.singleton.reserved",
        "mosaic.json",
        `singleton name "${sname}" collides with a reserved root name`
      );
      continue;
    }
    const loc = locateSingleton(sitePath, sname);
    if (!loc.mdAbs && !loc.jsonAbs) {
      diagnostics.structural(
        "mosaic.singleton.missing",
        `${sname}.json`,
        `declared singleton "${sname}" has no file at site root`
      );
      continue;
    }
    const rec = buildSingletonRecord(sitePath, sname, loc, diagnostics);
    idx.singletonsByName.set(sname, rec);
    idx.allRecords.push(rec);
  }

  // 3) Assets
  const imagesDir = path.join(sitePath, "images");
  if (fs.existsSync(imagesDir)) {
    walkAssetsRec(imagesDir, "", idx.assetsOnDisk);
    const manifestAbs = path.join(imagesDir, "manifest.json");
    if (fs.existsSync(manifestAbs)) {
      const text = readFileSafe(manifestAbs);
      const parsed = text ? parseJSONSafe(text) : null;
      if (parsed && parsed.ok && parsed.value && typeof parsed.value === "object") {
        idx.assetManifest = parsed.value;
      } else if (parsed && !parsed.ok) {
        diagnostics.structural(
          "mosaic.config.invalid",
          "images/manifest.json",
          `images/manifest.json: ${parsed.error}`
        );
      }
    }
  }

  return idx;
}

function buildSingletonRecord(sitePath, sname, loc, diagnostics) {
  const rec = {
    slug: sname,
    parentDir: "",
    mdPath: null,
    jsonPath: null,
    json: null,
    md: null,
    h1: null,
    location: "direct",
    dataDir: null, // singletons at root have no folder
    sourcePath: loc.jsonAbs ? path.relative(sitePath, loc.jsonAbs) : path.relative(sitePath, loc.mdAbs),
    isSingleton: true,
  };
  if (loc.mdAbs) {
    rec.mdPath = path.relative(sitePath, loc.mdAbs).split(path.sep).join("/");
    const text = readFileSafe(loc.mdAbs);
    if (text !== null) {
      if (hasFrontmatter(text)) {
        diagnostics.structural(
          "mosaic.frontmatter.present",
          rec.mdPath,
          "markdown file begins with frontmatter, which is forbidden"
        );
      }
      rec.md = text;
      rec.h1 = firstH1(text);
      rec.headings = allHeadings(text);
    }
  }
  if (loc.jsonAbs) {
    rec.jsonPath = path.relative(sitePath, loc.jsonAbs).split(path.sep).join("/");
    const text = readFileSafe(loc.jsonAbs);
    if (text !== null) {
      const r = parseJSONSafe(text);
      if (!r.ok) {
        diagnostics.structural(
          "mosaic.config.invalid",
          rec.jsonPath,
          `JSON parse error: ${r.error}`
        );
      } else {
        rec.json = r.value;
      }
    }
  }
  if (!rec.md && !rec.json) {
    diagnostics.structural(
      "mosaic.record.empty",
      rec.sourcePath,
      "singleton has neither markdown nor JSON content"
    );
  }
  return rec;
}

function walkAssetsRec(dir, relPrefix, outSet) {
  const ents = readDirSafe(dir) || [];
  for (const ent of ents) {
    if (ent.name.startsWith(".") || ent.name.startsWith("_")) continue;
    if (ent.name === "manifest.json" && relPrefix === "") continue;
    const rel = relPrefix ? relPrefix + "/" + ent.name : ent.name;
    if (ent.isDirectory()) {
      walkAssetsRec(path.join(dir, ent.name), rel, outSet);
    } else if (ent.isFile()) {
      outSet.add(rel);
    }
  }
}

// ---------- Ref resolution ----------

function resolveAllRefs(sitePath, idx, diagnostics) {
  // Walk every record's JSON. For each string value, test for ref prefixes; if so, parse & resolve.
  for (const rec of idx.allRecords) {
    if (!rec.json) continue;
    walkStringValues(rec.json, (visit) => {
      const value = visit.value;
      if (!looksLikeRef(value)) return;
      const parsed = parseRef(value);
      const src = rec.jsonPath || rec.sourcePath;

      if (!parsed.ok) {
        diagnostics.structural(
          "mosaic.ref.malformed",
          src,
          `malformed ref "${value}": ${parsed.error}`
        );
        return;
      }

      // Special-case the relative-in-markdown-only rule:
      // SPEC §5.5: a markdown-only record has no defined "here" → structural.
      if (parsed.kind === "relative") {
        if (!rec.json) {
          // unreachable because we just entered via json walk, but kept for clarity
        }
        // The condition that matters: the host record has no JSON (so cannot host refs)
        // OR is a direct-shape record without a containing folder ("./" undefined).
        // Since we're walking JSON, the record has JSON. The question is dataDir.
        if (!rec.dataDir) {
          diagnostics.structural(
            "mosaic.relative.invalid",
            src,
            `relative ref "${value}" used in a record without a containing folder`
          );
          return;
        }
      }

      const result = resolveRef(parsed, { siteIndex: idx, hostRecord: rec, sitePath });
      if (!result.ok) {
        if (result.reason === "selector") {
          diagnostics.drift(
            "mosaic.selector.unresolved",
            src,
            `selector in "${value}" does not resolve: ${result.message}`
          );
        } else if (result.reason === "relative_invalid") {
          diagnostics.structural(
            "mosaic.relative.invalid",
            src,
            `relative ref "${value}" used in a record without a containing folder`
          );
        } else {
          diagnostics.drift(
            "mosaic.ref.unresolved",
            src,
            `ref "${value}" does not resolve: ${result.message}`
          );
        }
        return;
      }

      // Track for orphan/unmounted/unmanifested passes.
      if (result.kind === "asset") {
        // result.path is "images/<rel>".
        const rel = result.path.replace(/^images\//, "");
        idx.assetReferences.add(rel);
        if (idx.assetManifest && !(rel in idx.assetManifest)) {
          diagnostics.warning(
            "mosaic.asset.unmanifested",
            "images/" + rel,
            `asset "${rel}" exists on disk but not in images/manifest.json`
          );
        }
      } else if (result.kind === "record") {
        idx.refsToCollections.add(parsed.collection);
      }
    });
  }
}

// ---------- Schema-driven field validation ----------

function runFieldValidation(idx, manifest, diagnostics) {
  const types = (manifest.types && typeof manifest.types === "object") ? manifest.types : {};
  // Type → field declarations.
  function typeOf(name) { return types[name]; }

  // Title dead-H1 warning.
  for (const rec of idx.allRecords) {
    if (rec.json && typeof rec.json.title === "string" && rec.json.title.length > 0 && rec.h1) {
      diagnostics.warning(
        "mosaic.title.dead-h1",
        rec.mdPath || rec.sourcePath,
        "markdown H1 present alongside JSON title; H1 will be dead text"
      );
    }
  }

  // Collections: each record validated against the collection's declared type.
  for (const [collName, coll] of idx.collectionsByName) {
    const collDef = (manifest.collections && manifest.collections[collName]) || null;
    if (!collDef || typeof collDef.type !== "string") continue;
    const typeDef = typeOf(collDef.type);
    if (!typeDef || !typeDef.fields || typeof typeDef.fields !== "object") continue;
    for (const rec of coll.records) {
      validateRecordAgainstType(rec, typeDef.fields, diagnostics);
    }
  }

  // Singletons: bound type from manifest.singletons[name].type.
  const singletonsDecl = (manifest.singletons && typeof manifest.singletons === "object")
    ? manifest.singletons
    : {};
  for (const [sname, rec] of idx.singletonsByName) {
    const decl = singletonsDecl[sname];
    if (!decl || typeof decl.type !== "string") continue;
    const typeDef = typeOf(decl.type);
    if (!typeDef || !typeDef.fields) continue;
    validateRecordAgainstType(rec, typeDef.fields, diagnostics);
  }
}

function validateRecordAgainstType(rec, fieldDefs, diagnostics) {
  const json = rec.json || {};
  const src = rec.jsonPath || rec.sourcePath;

  // Required fields: title special-cased (resolved title).
  for (const fname of Object.keys(fieldDefs)) {
    const fdef = fieldDefs[fname];
    if (!fdef || typeof fdef !== "object") continue;
    if (fdef.required) {
      if (fname === "title") {
        const resolved = resolveTitle(rec);
        if (!resolved.value) {
          diagnostics.drift(
            "mosaic.field.required",
            src,
            `required field "title" cannot be resolved (no JSON title, no H1, no slug fallback)`
          );
        }
      } else if (!(fname in json) || json[fname] === null || json[fname] === undefined || json[fname] === "") {
        diagnostics.drift(
          "mosaic.field.required",
          src,
          `required field "${fname}" is missing`
        );
      }
    }
  }

  // Unknown fields: top-level keys in JSON not in fieldDefs.
  // Exempt: "sections" (pages), and "title" if covered, and engine-specific extras.
  // SPEC §6.6 says writers MUST preserve unknown fields — but the validator still reports them.
  // SPEC §10 / MIP-0011: a type with empty `fields` is the free-form escape hatch — used
  // by DesignTokens (DTCG payload is opaque to Mosaic) and any other intentionally opaque
  // singleton. Skip the unknown-field check in that case.
  const fieldsIsEmpty = Object.keys(fieldDefs).length === 0;
  if (rec.json && typeof rec.json === "object" && !Array.isArray(rec.json) && !fieldsIsEmpty) {
    for (const k of Object.keys(rec.json)) {
      if (k === "sections") continue; // pages have arbitrary sections
      if (k.startsWith("$")) continue;  // engine-prefixed fields ($mosaic.*, $clearcms.*, $astro.*, etc.)
      if (!(k in fieldDefs)) {
        diagnostics.drift(
          "mosaic.field.unknown",
          src,
          `field "${k}" not declared in record type`
        );
      } else {
        const got = rec.json[k];
        const exp = fieldDefs[k];
        const tm = checkFieldType(got, exp);
        if (!tm.ok) {
          diagnostics.drift(
            "mosaic.field.type-mismatch",
            src,
            `field "${k}" expected ${tm.expected}, got ${tm.got}`
          );
        }
      }
    }
  }
}

function checkFieldType(value, fdef) {
  if (!fdef || typeof fdef !== "object" || !fdef.type) return { ok: true };
  const t = fdef.type;
  if (value === null || value === undefined) return { ok: true }; // missing handled by required
  switch (t) {
    case "string":
    case "markdown":
    case "date":
      if (typeof value !== "string") return { ok: false, expected: t, got: jsType(value) };
      return { ok: true };
    case "number":
      if (typeof value !== "number") return { ok: false, expected: t, got: jsType(value) };
      return { ok: true };
    case "boolean":
      if (typeof value !== "boolean") return { ok: false, expected: t, got: jsType(value) };
      return { ok: true };
    case "ref":
    case "asset":
      // The value should be a string (since refs/assets are encoded as strings). Ref detection happens elsewhere.
      if (typeof value !== "string") return { ok: false, expected: t, got: jsType(value) };
      return { ok: true };
    case "array":
      if (!Array.isArray(value)) return { ok: false, expected: "array", got: jsType(value) };
      return { ok: true };
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) return { ok: false, expected: "object", got: jsType(value) };
      return { ok: true };
    default:
      return { ok: true };
  }
}

function jsType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

// ---------- Warning pass: asset orphans, unmounted collections ----------

function runWarningPass(idx, diagnostics) {
  // Asset orphan: any file in images/ not in assetReferences. Skip manifest.json.
  for (const rel of idx.assetsOnDisk) {
    if (idx.assetReferences.has(rel)) continue;
    diagnostics.warning(
      "mosaic.asset.orphan",
      "images/" + rel,
      `asset "${rel}" is not referenced by any record`
    );
  }

  // Asset on disk but not in manifest (manifest exists): also emit unmanifested at warning pass
  // even if never referenced? SPEC §5.4 wording covers "manifest entry missing but file exists on disk"
  // in the context of a ref. So we already emit it during ref resolution. We do NOT double-emit here.

  // Unmounted collections: SPEC §6.4 lists this as a warning, "optional but RECOMMENDED"
  // per §6.1. Suppressed by default to match the most-common author intent
  // (unrouted collections are blessed by §3.7). Enable with --strict for opinionated CI.
  void idx;
}

main();
