#!/usr/bin/env node
"use strict";

// Interactive step-by-step migrator: Astro site -> Mosaic 0.8.
// Zero deps. Node stdlib only.

const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const { makePrompter } = require("./lib/prompt");
const { scanSource } = require("./lib/scan");
const { buildPlan } = require("./lib/plan");
const { emitSite, summarizeWritten } = require("./lib/write");
const { summarizeMessages } = require("./lib/messages");

function parseArgs(argv) {
  const args = {
    source: null,
    out: null,
    yes: false,
    dryRun: false,
    config: null,
    force: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source") args.source = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--yes" || a === "-y") args.yes = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--config") args.config = argv[++i];
    else if (a === "--force") args.force = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else {
      process.stderr.write(`unknown arg: ${a}\n`);
      process.exit(64);
    }
  }
  return args;
}

function usage() {
  process.stdout.write(`Usage: migrate.js --source <astro-site> --out <mosaic-site> [--yes] [--dry-run] [--config <file>] [--force]

Walks an Astro site and emits Mosaic 0.8 shape into <out>.
  --source     path to Astro project root
  --out        path to Mosaic output (created if missing; refuses non-empty unless --force)
  --yes        accept all proposed defaults non-interactively
  --dry-run    show plan, write nothing
  --config     load previously-saved decisions JSON for reproducibility
  --force      overwrite an existing non-empty <out>
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.source || !args.out) {
    usage();
    process.exit(args.help ? 0 : 64);
  }

  const sourceRoot = path.resolve(args.source);
  const outDir = path.resolve(args.out);

  // Refuse if source is also out (catches self-overwrite).
  if (sourceRoot === outDir) {
    process.stderr.write("--source and --out must differ\n");
    process.exit(64);
  }
  // Refuse to write inside source (protect clear-ucc-ref).
  if (outDir.startsWith(sourceRoot + path.sep) || outDir === sourceRoot) {
    process.stderr.write("refusing to write inside source directory\n");
    process.exit(64);
  }

  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    process.stderr.write(`source not a directory: ${sourceRoot}\n`);
    process.exit(64);
  }

  // Out directory: create or check empty.
  if (fs.existsSync(outDir)) {
    const entries = fs.readdirSync(outDir).filter((n) => n !== ".mosaic-migration-decisions.json");
    if (entries.length > 0 && !args.force && !args.dryRun) {
      process.stderr.write(`refusing to write into non-empty ${outDir} (use --force)\n`);
      process.exit(65);
    }
  } else if (!args.dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Load saved decisions if --config.
  let savedDecisions = null;
  if (args.config) {
    try { savedDecisions = JSON.parse(fs.readFileSync(args.config, "utf8")); }
    catch (err) {
      process.stderr.write(`failed to read --config: ${err.message}\n`);
      process.exit(64);
    }
  }

  const prompt = makePrompter({ assumeYes: args.yes });

  prompt.heading("Mosaic interactive migration");
  prompt.info(`source: ${sourceRoot}`);
  prompt.info(`out:    ${outDir}`);
  if (args.dryRun) prompt.info("(dry-run — no files will be written)");

  // ---- Phase 1: scan ----
  prompt.heading("Phase 1 / 10 — Scan source");
  const scan = scanSource(sourceRoot);
  prompt.info(`  Astro config: ${scan.astroConfig ? "found (" + path.basename(scan.astroConfig.path) + ")" : "not found"}`);
  prompt.info(`  site URL:     ${scan.siteUrl || "(none)"}`);
  prompt.info(`  pages files:  ${scan.pages.length} (in src/pages)`);
  const astroPages = scan.pages.filter((p) => p.kind === "astro" && !p.isApi && !p.isXml).length;
  const mdPages = scan.pages.filter((p) => p.kind === "markdown").length;
  const apiRoutes = scan.pages.filter((p) => p.isApi || p.isXml).length;
  prompt.info(`    astro:      ${astroPages}`);
  prompt.info(`    markdown:   ${mdPages}`);
  prompt.info(`    api/xml:    ${apiRoutes}`);
  prompt.info(`  collections:  ${scan.contentCollections.length}`);
  for (const c of scan.contentCollections) {
    prompt.info(`    ${c.name.padEnd(22)} ${String(c.recordCount).padStart(4)} records${c.perLocale ? " (locales: " + c.locales.join(",") + ")" : ""}`);
  }
  prompt.info(`  public files: ${scan.publicFiles.length} (${scan.publicFiles.filter((f) => f.isImage).length} images, ${(scan.publicImageBytes / 1024 / 1024).toFixed(1)} MB)`);
  prompt.info(`  components:   ${scan.componentsCount}`);
  prompt.info(`  layouts:      ${scan.layoutsCount}`);
  prompt.info(`  inlang:       ${scan.hasInlang ? "yes (" + scan.messages.locales.join(",") + ")" : "no"}`);

  const proceed = await prompt.yesno("Continue?", true);
  if (!proceed) { prompt.close(); process.exit(0); }

  // ---- Build plan ----
  const plan = buildPlan(scan);
  // Apply saved-decision overrides (site identity is the only one we expose for replay).
  if (savedDecisions && savedDecisions.site) {
    plan.site = Object.assign({}, plan.site, savedDecisions.site);
  }

  // ---- Phase 2: site identity ----
  prompt.heading("Phase 2 / 10 — Site identity");
  prompt.info(`  proposed name:   ${plan.site.name}`);
  prompt.info(`  proposed locale: ${plan.site.locale}`);
  prompt.info(`  proposed url:    ${plan.site.url || "(none)"}`);
  if (!args.yes) {
    plan.site.name = await prompt.ask("Site name", plan.site.name);
    plan.site.locale = await prompt.ask("Site locale (BCP-47)", plan.site.locale);
    plan.site.url = await prompt.ask("Site URL", plan.site.url || "");
  }

  // ---- Phase 3: pages ----
  prompt.heading("Phase 3 / 10 — Pages");
  prompt.info(`  ${plan.pageEntries.length} page records will be created.`);
  for (const pe of plan.pageEntries.slice(0, 20)) {
    prompt.info(`    write ${pe.targetRel}`);
    if (pe.notes) for (const n of pe.notes) prompt.info(`      note: ${n}`);
  }
  if (plan.pageEntries.length > 20) prompt.info(`    ... (${plan.pageEntries.length - 20} more)`);
  await prompt.yesno("Accept page plan?", true);

  // ---- Phase 4: collections ----
  prompt.heading("Phase 4 / 10 — Collections + types");
  for (const [name, col] of Object.entries(plan.collections)) {
    const type = plan.types[col.type];
    const fields = type && type.fields ? Object.keys(type.fields) : [];
    const recCount = plan.collectionEntries.filter((e) => e.targetRel.startsWith(`collections/${name}/`)).length;
    prompt.info(`  ${name}  (type=${col.type}, records=${recCount}, mount=${col.defaultMount}, sort=${col.defaultSort || "fs"})`);
    prompt.info(`    fields: ${fields.length ? fields.join(", ") : "(empty)"}`);
  }
  await prompt.yesno("Accept collection plan?", true);

  // ---- Phase 5: messages ----
  prompt.heading("Phase 5 / 10 — Messages (inlang/paraglide)");
  if (plan.messagesPath) {
    const payload = require("./lib/messages").loadMessagesPayload(scan.messages);
    const summary = summarizeMessages(payload);
    for (const [loc, count] of Object.entries(summary)) {
      prompt.info(`    ${loc}: ${count} keys`);
    }
    prompt.info(`  will emit ${plan.messagesPath} singleton (free-form Messages type)`);
    await prompt.yesno("Accept messages plan?", true);
  } else {
    prompt.info("  no inlang config / messages dir detected — skipping");
  }

  // ---- Phase 6: singletons ----
  prompt.heading("Phase 6 / 10 — Singletons");
  for (const se of plan.singletonEntries) prompt.info(`  write ${se.targetRel}`);
  await prompt.yesno("Accept singleton plan?", true);

  // ---- Phase 7: assets ----
  prompt.heading("Phase 7 / 10 — Assets");
  const totalImages = plan.assets.length;
  const totalBig = plan.assets.filter((a) => a.big).length;
  const totalDocs = plan.documents.length;
  prompt.info(`  ${totalImages} images -> images/`);
  prompt.info(`  ${totalDocs} non-image public files -> _astro-public/`);
  if (totalBig) {
    prompt.info(`  ${totalBig} files >5MB:`);
    for (const a of plan.assets.filter((a) => a.big)) {
      prompt.info(`    ${a.targetRel}  (${(a.size / 1024 / 1024).toFixed(1)} MB)`);
    }
    const keepBig = await prompt.yesno("Copy >5MB assets?", true);
    if (!keepBig) {
      plan.assets = plan.assets.filter((a) => !a.big);
      prompt.info(`  (will skip ${totalBig} large files)`);
    }
  }

  // ---- Phase 8: redirects ----
  prompt.heading("Phase 8 / 10 — Redirects");
  prompt.info(`  ${plan.redirects.length} redirects will be lifted into mosaic.json#redirects`);
  if (plan.redirects.length > 0 && plan.redirects.length <= 12) {
    for (const r of plan.redirects) prompt.info(`    ${r.from} -> ${r.to}`);
  } else if (plan.redirects.length > 12) {
    for (const r of plan.redirects.slice(0, 12)) prompt.info(`    ${r.from} -> ${r.to}`);
    prompt.info(`    ... (${plan.redirects.length - 12} more)`);
  }
  await prompt.yesno("Accept redirect plan?", true);

  // ---- Phase 9: engine-extension preservation ----
  prompt.heading("Phase 9 / 10 — Engine-extension preservation");
  const astroPreservedCount = plan.collectionEntries.filter((e) => e.json && e.json["$astro"]).length;
  prompt.info(`  ${astroPreservedCount} records will carry an $astro field (frontmatter + localized vars + translations).`);
  if (plan.skipped.length) {
    prompt.info("  skipped:");
    for (const s of plan.skipped.slice(0, 8)) prompt.info(`    ${s.source}  (${s.reason})`);
    if (plan.skipped.length > 8) prompt.info(`    ... (${plan.skipped.length - 8} more)`);
  }

  // ---- Phase 10: write ----
  prompt.heading("Phase 10 / 10 — Write");
  const written = emitSite(plan, scan, outDir, { dryRun: args.dryRun });
  const sum = summarizeWritten(written);
  prompt.info(`  ${args.dryRun ? "would write" : "wrote"} ${sum.fileCount} files (${(sum.totalBytes / 1024).toFixed(1)} KB)`);
  for (const [k, v] of Object.entries(sum.byTopLevel)) prompt.info(`    ${k.padEnd(20)} ${v}`);

  // Persist decisions for replay.
  if (!args.dryRun) {
    const decisions = {
      generatedAt: new Date().toISOString(),
      source: sourceRoot,
      site: plan.site,
      collectionTypes: Object.fromEntries(Object.entries(plan.collections).map(([k, v]) => [k, v.type])),
      redirectCount: plan.redirects.length,
    };
    fs.writeFileSync(path.join(outDir, ".mosaic-migration-decisions.json"), JSON.stringify(decisions, null, 2));
    prompt.info(`  decisions saved to ${path.join(outDir, ".mosaic-migration-decisions.json")}`);
  }

  prompt.close();
  prompt.info("\nDone. Next: run `node tools/validate/impl/validate.js --site " + outDir + " --human` to validate.");
}

main().catch((err) => {
  process.stderr.write("migrate failed: " + err.stack + "\n");
  process.exit(70);
});
