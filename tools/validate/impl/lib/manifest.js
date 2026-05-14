"use strict";

// Loads mosaic.json and validates shape per SPEC §8 and the JSON Schema.
// Does shape checks in code rather than running a generic JSON Schema engine.

const fs = require("node:fs");
const path = require("node:path");

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const TYPE_NAME_RE = /^[A-Za-z][A-Za-z0-9]*$/;
const FIELD_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const VERSION_RE = /^[0-9]+\.[0-9]+(\.[0-9]+)?$/;
const DEFAULT_SORT_RE = /^[A-Za-z_][A-Za-z0-9_]*\s+(asc|desc)$/;
const DEFAULT_MOUNT_RE = /^\/[a-z0-9-/]*$/;
const FIELD_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "date",
  "markdown",
  "ref",
  "asset",
  "array",
  "object",
]);
const PRIMITIVE_ARRAY_ITEM_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "date",
  "markdown",
  "ref",
  "asset",
]);

function loadManifest(sitePath, diagnostics) {
  const manifestPath = path.join(sitePath, "mosaic.json");
  if (!fs.existsSync(manifestPath)) {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      "mosaic.json not found at site root"
    );
    return null;
  }
  let raw;
  try {
    raw = fs.readFileSync(manifestPath, "utf8");
  } catch (err) {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      `failed to read mosaic.json: ${err.message}`
    );
    return null;
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      `mosaic.json is not valid JSON: ${err.message}`
    );
    return null;
  }
  validateManifestShape(manifest, diagnostics);
  return manifest;
}

function validateManifestShape(manifest, diagnostics) {
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      "mosaic.json must be a JSON object"
    );
    return;
  }

  // Required top-level: version, site, types, collections, singletons.
  // (singletons may have been called "globals" in 0.7-vintage tests; tolerate.)
  const required = ["version", "site", "types", "collections"];
  for (const key of required) {
    if (!(key in manifest)) {
      diagnostics.structural(
        "mosaic.config.invalid",
        "mosaic.json",
        `missing required top-level key "${key}"`
      );
    }
  }
  // singletons is required in 0.8 but old test sites declare "globals".
  // Accept either to allow 0.7 sites to still parse.
  if (!("singletons" in manifest) && !("globals" in manifest)) {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      'missing required top-level key "singletons"'
    );
  }

  if (typeof manifest.version === "string" && !VERSION_RE.test(manifest.version)) {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      `version "${manifest.version}" doesn't match X.Y or X.Y.Z`
    );
  }

  if (manifest.site && typeof manifest.site === "object") {
    if (!manifest.site.name || typeof manifest.site.name !== "string") {
      diagnostics.structural(
        "mosaic.config.invalid",
        "mosaic.json",
        "site.name is required and must be a non-empty string"
      );
    }
  } else if ("site" in manifest) {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      "site must be an object"
    );
  }

  if (manifest.types && typeof manifest.types === "object") {
    for (const typeName of Object.keys(manifest.types)) {
      if (!TYPE_NAME_RE.test(typeName)) {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `type name "${typeName}" doesn't match ^[A-Za-z][A-Za-z0-9]*$`
        );
        continue;
      }
      const typeDef = manifest.types[typeName];
      if (!typeDef || typeof typeDef !== "object") {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `type "${typeName}" must be an object`
        );
        continue;
      }
      if (!typeDef.fields || typeof typeDef.fields !== "object") {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `type "${typeName}" is missing required "fields" object`
        );
        continue;
      }
      validateFields(typeDef.fields, `types.${typeName}.fields`, diagnostics);
    }
  }

  if (manifest.collections && typeof manifest.collections === "object") {
    for (const cname of Object.keys(manifest.collections)) {
      if (!NAME_RE.test(cname)) {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `collection name "${cname}" doesn't match slug pattern`
        );
        continue;
      }
      const c = manifest.collections[cname];
      if (!c || typeof c !== "object") {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `collection "${cname}" must be an object`
        );
        continue;
      }
      if (typeof c.type !== "string") {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `collection "${cname}" is missing required "type" string`
        );
      }
      if (c.defaultSort && !DEFAULT_SORT_RE.test(c.defaultSort)) {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `collection "${cname}".defaultSort "${c.defaultSort}" must match "<field> asc|desc"`
        );
      }
      if (c.defaultMount && !DEFAULT_MOUNT_RE.test(c.defaultMount)) {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `collection "${cname}".defaultMount "${c.defaultMount}" must match ^/[a-z0-9-/]*$`
        );
      }
    }
  }

  if (manifest.singletons && typeof manifest.singletons === "object") {
    for (const sname of Object.keys(manifest.singletons)) {
      if (!NAME_RE.test(sname)) {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `singleton name "${sname}" doesn't match slug pattern`
        );
        continue;
      }
      const s = manifest.singletons[sname];
      if (!s || typeof s !== "object" || typeof s.type !== "string") {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `singleton "${sname}" must be an object with a "type" string`
        );
      }
    }
  }

  if (manifest.redirects !== undefined) {
    if (!Array.isArray(manifest.redirects)) {
      diagnostics.structural(
        "mosaic.config.invalid",
        "mosaic.json",
        "redirects must be an array"
      );
    } else {
      manifest.redirects.forEach((r, i) => {
        if (!r || typeof r !== "object") {
          diagnostics.structural(
            "mosaic.config.invalid",
            "mosaic.json",
            `redirects[${i}] must be an object`
          );
          return;
        }
        if (typeof r.from !== "string" || !r.from.startsWith("/")) {
          diagnostics.structural(
            "mosaic.config.invalid",
            "mosaic.json",
            `redirects[${i}].from must be a string starting with "/"`
          );
        }
        if (typeof r.to !== "string" || r.to.length === 0) {
          diagnostics.structural(
            "mosaic.config.invalid",
            "mosaic.json",
            `redirects[${i}].to must be a non-empty string`
          );
        }
        if (
          r.status !== undefined &&
          ![301, 302, 307, 308].includes(r.status)
        ) {
          diagnostics.structural(
            "mosaic.config.invalid",
            "mosaic.json",
            `redirects[${i}].status must be 301, 302, 307, or 308`
          );
        }
      });
    }
  }
}

function validateFields(fields, ctx, diagnostics) {
  for (const fname of Object.keys(fields)) {
    if (!FIELD_NAME_RE.test(fname)) {
      diagnostics.structural(
        "mosaic.config.invalid",
        "mosaic.json",
        `${ctx}: field name "${fname}" doesn't match ^[A-Za-z_][A-Za-z0-9_]*$`
      );
      continue;
    }
    const f = fields[fname];
    if (!f || typeof f !== "object") {
      diagnostics.structural(
        "mosaic.config.invalid",
        "mosaic.json",
        `${ctx}.${fname} must be an object`
      );
      continue;
    }
    if (!FIELD_TYPES.has(f.type)) {
      diagnostics.structural(
        "mosaic.config.invalid",
        "mosaic.json",
        `${ctx}.${fname}.type "${f.type}" is not a known field type`
      );
      continue;
    }
    if (f.type === "array") {
      if (f.of === undefined) {
        diagnostics.structural(
          "mosaic.config.invalid",
          "mosaic.json",
          `${ctx}.${fname} is type "array" but missing "of"`
        );
      } else {
        validateListItem(f.of, `${ctx}.${fname}.of`, diagnostics);
      }
    }
    if (f.type === "object" && f.fields && typeof f.fields === "object") {
      validateFields(f.fields, `${ctx}.${fname}.fields`, diagnostics);
    }
  }
}

function validateListItem(item, ctx, diagnostics) {
  if (typeof item === "string") {
    if (!PRIMITIVE_ARRAY_ITEM_TYPES.has(item)) {
      diagnostics.structural(
        "mosaic.config.invalid",
        "mosaic.json",
        `${ctx} primitive "${item}" is not allowed`
      );
    }
    return;
  }
  if (!item || typeof item !== "object") {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      `${ctx} must be a string or object`
    );
    return;
  }
  if (item.kind !== "ref" && item.kind !== "object") {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      `${ctx}.kind must be "ref" or "object"`
    );
    return;
  }
  if (item.kind === "ref" && typeof item.to !== "string") {
    diagnostics.structural(
      "mosaic.config.invalid",
      "mosaic.json",
      `${ctx} kind=ref requires "to" string`
    );
  }
  if (item.kind === "object") {
    if (!item.fields || typeof item.fields !== "object") {
      diagnostics.structural(
        "mosaic.config.invalid",
        "mosaic.json",
        `${ctx} kind=object requires "fields" object`
      );
    } else {
      validateFields(item.fields, `${ctx}.fields`, diagnostics);
    }
  }
}

module.exports = { loadManifest };
