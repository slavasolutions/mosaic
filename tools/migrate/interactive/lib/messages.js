"use strict";

// inlang/paraglide message handling.
// Detects messages/<locale>.json or project.inlang/settings.json,
// loads each locale into a single Mosaic messages.json singleton.

const fs = require("node:fs");
const path = require("node:path");

function detectMessages(sourceRoot) {
  const out = { kind: null, locales: [], files: {}, settingsPath: null, baseLocale: null };

  const settingsPath = path.join(sourceRoot, "project.inlang", "settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      out.kind = "inlang";
      out.settingsPath = settingsPath;
      out.baseLocale = settings.baseLocale || null;
      out.locales = Array.isArray(settings.locales) ? settings.locales.slice() : [];
      const pattern = (settings["plugin.inlang.messageFormat"] || {}).pathPattern || "./messages/{locale}.json";
      for (const locale of out.locales) {
        const rel = pattern.replace("{locale}", locale).replace(/^\.\//, "");
        const abs = path.join(sourceRoot, rel);
        if (fs.existsSync(abs)) out.files[locale] = abs;
      }
    } catch (err) {
      out.kind = "inlang";
      out.error = "settings-unparseable: " + err.message;
    }
  } else {
    // Fall back to bare messages/<locale>.json directory.
    const messagesDir = path.join(sourceRoot, "messages");
    if (fs.existsSync(messagesDir) && fs.statSync(messagesDir).isDirectory()) {
      out.kind = "plain";
      for (const entry of fs.readdirSync(messagesDir)) {
        if (!entry.endsWith(".json")) continue;
        const locale = entry.replace(/\.json$/, "");
        out.locales.push(locale);
        out.files[locale] = path.join(messagesDir, entry);
      }
      out.baseLocale = out.locales.includes("en") ? "en" : out.locales[0] || null;
    }
  }

  return out;
}

function loadMessagesPayload(detected) {
  const payload = {};
  for (const [locale, abs] of Object.entries(detected.files || {})) {
    try {
      const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
      // Strip $schema if inlang wrote it.
      if (raw && typeof raw === "object" && raw.$schema) {
        delete raw.$schema;
      }
      payload[locale] = raw;
    } catch (err) {
      payload[locale] = { __error__: err.message };
    }
  }
  return payload;
}

function summarizeMessages(payload) {
  const out = {};
  for (const [locale, body] of Object.entries(payload || {})) {
    if (!body || typeof body !== "object") { out[locale] = 0; continue; }
    out[locale] = Object.keys(body).filter((k) => !k.startsWith("$")).length;
  }
  return out;
}

module.exports = { detectMessages, loadMessagesPayload, summarizeMessages };
