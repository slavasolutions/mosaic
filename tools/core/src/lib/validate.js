// Field-level validation against the type system: required fields, unknown
// fields, type mismatches, dead H1, and the orphan/unmanifested warnings.

import { resolveTitle } from "./markdown.js";

export function validateFields(site, diagnostics) {
  const manifest = site.manifest;
  if (!manifest) return;
  const types = (manifest.types && typeof manifest.types === "object") ? manifest.types : {};

  // Dead-H1 warnings.
  for (const rec of site.allRecords) {
    if (rec.json && typeof rec.json.title === "string" && rec.json.title.length > 0 && rec.h1) {
      diagnostics.warning(
        "mosaic.title.dead-h1",
        rec.mdPath || rec.sourcePath,
        "markdown H1 present alongside JSON title; H1 will be dead text",
      );
    }
  }

  // Collection records → declared type.
  for (const [collName, coll] of site.collectionsByName) {
    const collDef = (manifest.collections && manifest.collections[collName]) || null;
    if (!collDef || typeof collDef.type !== "string") continue;
    const typeDef = types[collDef.type];
    if (!typeDef || !typeDef.fields || typeof typeDef.fields !== "object") continue;
    for (const rec of coll.records) {
      validateRecordAgainstType(rec, typeDef.fields, diagnostics);
    }
  }

  // Singletons → declared type.
  const singletonsDecl = (manifest.singletons && typeof manifest.singletons === "object") ? manifest.singletons : {};
  for (const [sname, rec] of site.singletonsByName) {
    const decl = singletonsDecl[sname];
    if (!decl || typeof decl.type !== "string") continue;
    const typeDef = types[decl.type];
    if (!typeDef || !typeDef.fields) continue;
    validateRecordAgainstType(rec, typeDef.fields, diagnostics);
  }

  // Asset orphan warnings.
  for (const rel of site.assetsOnDisk) {
    if (site.assetReferences.has(rel)) continue;
    diagnostics.warning(
      "mosaic.asset.orphan",
      "images/" + rel,
      `asset "${rel}" is not referenced by any record`,
    );
  }
}

function validateRecordAgainstType(rec, fieldDefs, diagnostics) {
  const json = rec.json || {};
  const src = rec.jsonPath || rec.sourcePath;

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
            'required field "title" cannot be resolved (no JSON title, no H1, no slug fallback)',
          );
        }
      } else if (!(fname in json) || json[fname] === null || json[fname] === undefined || json[fname] === "") {
        diagnostics.drift(
          "mosaic.field.required",
          src,
          `required field "${fname}" is missing`,
        );
      }
    }
  }

  const fieldsIsEmpty = Object.keys(fieldDefs).length === 0;
  if (rec.json && typeof rec.json === "object" && !Array.isArray(rec.json) && !fieldsIsEmpty) {
    for (const k of Object.keys(rec.json)) {
      if (k === "sections") continue;
      if (k.startsWith("$")) continue;
      if (!(k in fieldDefs)) {
        diagnostics.drift(
          "mosaic.field.unknown",
          src,
          `field "${k}" not declared in record type`,
        );
      } else {
        const got = rec.json[k];
        const tm = checkFieldType(got, fieldDefs[k]);
        if (!tm.ok) {
          diagnostics.drift(
            "mosaic.field.type-mismatch",
            src,
            `field "${k}" expected ${tm.expected}, got ${tm.got}`,
          );
        }
      }
    }
  }
}

function checkFieldType(value, fdef) {
  if (!fdef || typeof fdef !== "object" || !fdef.type) return { ok: true };
  const t = fdef.type;
  if (value === null || value === undefined) return { ok: true };
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

// One-shot: load and validate a site. Returns the diagnostics array.
export function validateSite(sitePath) {
  // Lazy import to avoid circular dep at module load.
  return import("./index.js").then(({ loadSite }) => {
    const site = loadSite(sitePath);
    validateFields(site, site.diagnostics);
    return site.diagnostics.sorted();
  });
}
