"use strict";

// readline-based interactive prompts. Zero deps.
// Supports yes/no, choice (acc/cust/skip/quit), free text.

const readline = require("node:readline");

function makePrompter({ assumeYes = false, quiet = false } = {}) {
  let rl = null;

  function getRl() {
    if (rl) return rl;
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return rl;
  }

  function close() {
    if (rl) {
      rl.close();
      rl = null;
    }
  }

  function out(s) {
    if (!quiet) process.stdout.write(s);
  }

  function ask(question, defaultValue = "") {
    if (assumeYes) {
      out(question + (defaultValue ? ` [${defaultValue}]` : "") + " " + defaultValue + " (auto)\n");
      return Promise.resolve(defaultValue);
    }
    return new Promise((resolve) => {
      const prompt = question + (defaultValue ? ` [${defaultValue}]` : "") + ": ";
      getRl().question(prompt, (answer) => {
        const trimmed = (answer || "").trim();
        resolve(trimmed === "" ? defaultValue : trimmed);
      });
    });
  }

  async function choice(question, choices, defaultKey) {
    // choices: { a: "Accept", c: "Customize", s: "Skip", q: "Quit" }
    const keys = Object.keys(choices);
    const def = defaultKey || keys[0];
    const list = keys.map((k) => `${k === def ? k.toUpperCase() : k}=${choices[k]}`).join(" | ");
    const answer = await ask(question + "\n  " + list, def);
    const norm = String(answer || def).trim().toLowerCase().charAt(0);
    return keys.includes(norm) ? norm : def;
  }

  async function yesno(question, defaultYes = true) {
    const def = defaultYes ? "y" : "n";
    const answer = await ask(question + " (y/n)", def);
    return /^y/i.test(String(answer || def));
  }

  function info(s) {
    out(s + "\n");
  }

  function rule(s) {
    out("\n" + "─".repeat(72) + "\n");
    if (s) out(s + "\n");
  }

  function heading(s) {
    out("\n=== " + s + " ===\n");
  }

  return { ask, choice, yesno, info, rule, heading, close };
}

module.exports = { makePrompter };
