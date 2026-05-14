#!/usr/bin/env node
// Mosaic conformance test runner. Dependency-free.
// Usage: node run.js --tool "your-validator --json"

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function parseArgs(argv) {
  const args = { tool: null, conformance: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--tool") args.tool = argv[++i];
    else if (argv[i] === "--conformance") args.conformance = argv[++i];
  }
  if (!args.tool) {
    console.error("Usage: node run.js --tool \"<validator-command --json>\"");
    process.exit(64);
  }
  if (!args.conformance) {
    args.conformance = path.join(__dirname, "..", "conformance");
  }
  return args;
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function runTool(tool, sitePath) {
  const cmd = `${tool} --site ${JSON.stringify(sitePath)}`;
  try {
    const stdout = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, output: JSON.parse(stdout) };
  } catch (err) {
    // The validator exits non-zero on structural errors; output may still be valid JSON.
    if (err.stdout) {
      try { return { ok: true, output: JSON.parse(err.stdout) }; } catch (_) {}
    }
    return { ok: false, error: err.message };
  }
}

function compare(expected, actual) {
  const failures = [];

  if (expected.summary) {
    for (const sev of ["structural", "drift", "warning"]) {
      const e = expected.summary[sev] ?? 0;
      const a = actual.summary?.[sev] ?? 0;
      if (e !== a) failures.push(`summary.${sev}: expected ${e}, got ${a}`);
    }
  }

  for (const d of expected.diagnostics ?? []) {
    const match = (actual.diagnostics ?? []).find(
      (x) => x.code === d.code && (d.source ? x.source === d.source : true)
    );
    if (!match) failures.push(`missing diagnostic: ${d.code} @ ${d.source ?? "any"}`);
  }

  for (const r of expected.routes ?? []) {
    const match = (actual.routes ?? []).find((x) => x.url === r.url);
    if (!match) failures.push(`missing route: ${r.url}`);
  }

  return failures;
}

function main() {
  const args = parseArgs(process.argv);
  const tests = fs
    .readdirSync(args.conformance)
    .filter((d) => fs.statSync(path.join(args.conformance, d)).isDirectory())
    .sort();

  let pass = 0, fail = 0, skip = 0;

  for (const t of tests) {
    const dir = path.join(args.conformance, t);
    const sitePath = path.join(dir, "site");
    const expectedPath = path.join(dir, "expected.json");
    if (!fs.existsSync(expectedPath) || !fs.existsSync(sitePath)) {
      console.log(`SKIP   ${t}  (missing site/ or expected.json)`);
      skip++;
      continue;
    }

    const expected = readJSON(expectedPath);
    if (expected._stub) {
      console.log(`SKIP   ${t}  (stub)`);
      skip++;
      continue;
    }

    const result = runTool(args.tool, sitePath);
    if (!result.ok) {
      console.log(`FAIL   ${t}  (tool crashed: ${result.error})`);
      fail++;
      continue;
    }

    const failures = compare(expected, result.output);
    if (failures.length === 0) {
      console.log(`PASS   ${t}`);
      pass++;
    } else {
      console.log(`FAIL   ${t}`);
      for (const f of failures) console.log(`         ${f}`);
      fail++;
    }
  }

  console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
