#!/usr/bin/env node
// Mosaic 0.8 reference validator. Delegates to @mosaic/core.
// CLI: node validate.js --site <path> [--strict] [--json] [--quiet] [--human]

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { loadSite, validateFields, Diagnostics } from "../../core/src/index.js";

function parseArgs(argv) {
  // Default to JSON output. The conformance runner invokes the tool without --json
  // and expects stdout to be JSON. A --human flag opts in to the textual report.
  const args = { site: null, strict: false, json: true, quiet: false, human: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--site") args.site = argv[++i];
    else if (a === "--strict") args.strict = true;
    else if (a === "--json") { args.json = true; args.human = false; }
    else if (a === "--human") { args.human = true; args.json = false; }
    else if (a === "--quiet") args.quiet = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else {
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
    process.stdout.write("Usage: validate.js --site <path> [--strict] [--json] [--quiet]\n");
    process.exit(0);
  }
  if (!args.site) fail("missing --site <path>");

  const sitePath = path.resolve(args.site);

  // Pre-flight: handle the "site path doesn't exist" case the same way the
  // pre-refactor validator did — surface a single config.invalid diagnostic.
  if (!fs.existsSync(sitePath) || !fs.statSync(sitePath).isDirectory()) {
    const diagnostics = new Diagnostics();
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      `site path "${args.site}" not found or not a directory`,
    );
    return emit(diagnostics, sitePath, args, [], null);
  }

  const site = loadSite(sitePath);
  validateFields(site, site.diagnostics);

  return emit(site.diagnostics, sitePath, args, site.routes, site.manifest);
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

main();
