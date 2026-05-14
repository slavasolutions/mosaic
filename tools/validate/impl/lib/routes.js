"use strict";

// Build the route table: pages, collection-list mounts, redirects.
// Emit route.collision, collection.missing, redirect.loop, redirect.collision,
// redirect.duplicate-from, redirect.duplicate-source.

function buildRoutes(siteIndex, diagnostics) {
  // Returns { routes: [...], byUrl: Map }, and mutates siteIndex with recordUrls and routedCollections.
  const routes = [];
  const byUrl = new Map(); // url → { kind, target?, source? }
  const recordUrls = siteIndex.recordUrls; // pre-existing map (records → url)
  const routedCollections = siteIndex.routedCollections; // Set of collection names with routing mount

  // 1) Page routes (from pages/).
  for (const pageRec of siteIndex.pages) {
    const url = pageRec._url; // computed in walk
    if (!url) continue;
    addRouteOrCollide(byUrl, routes, diagnostics, {
      url,
      kind: "page",
      target: pageRec.sourcePath,
      sourcePath: pageRec.sourcePath,
    });
  }

  // 2) Collection-list mounts from pages' JSON.
  for (const pageRec of siteIndex.pages) {
    const sections = (pageRec.json && Array.isArray(pageRec.json.sections)) ? pageRec.json.sections : [];
    for (const sec of sections) {
      if (!sec || sec.type !== "collection-list") continue;
      const from = typeof sec.from === "string" ? sec.from : null;
      if (!from) continue;
      // Expect "collections/<name>".
      let collName = null;
      if (from.startsWith("collections/")) {
        collName = from.slice("collections/".length);
        // Strip any trailing slash.
        if (collName.endsWith("/")) collName = collName.slice(0, -1);
      }
      const coll = collName ? siteIndex.collectionsByName.get(collName) : null;
      if (!coll) {
        diagnostics.structural(
          "mosaic.collection.missing",
          pageRec.sourcePath,
          `collection-list references non-existent "${from}"`
        );
        continue;
      }
      // routes default true; routes:false means list-only.
      const routesEnabled = sec.routes !== false;
      // urlPattern default = <page-url>/{slug}
      const pageUrl = pageRec._url;
      const urlPattern = typeof sec.urlPattern === "string"
        ? sec.urlPattern
        : (pageUrl === "/" ? "/{slug}" : pageUrl + "/{slug}");

      if (routesEnabled) {
        routedCollections.add(collName);
        for (const rec of coll.records) {
          const detailUrl = urlPattern.replace(/\{slug\}/g, rec.slug);
          // Same target via two routing mounts (same final URL+target) → mint once, no collision.
          // Different URLs for the same record are handled because each mount yields its own URL.
          // Two mounts pointing to the same URL but to different targets → collision.
          const targetId = `record:${collName}/${rec.slug}`;
          if (recordUrls.has(rec) && recordUrls.get(rec) !== detailUrl) {
            // Record already routed at a different URL — that's "different URLs for same record" → collision per §3.5.
            diagnostics.structural(
              "mosaic.route.collision",
              `collections/${collName}/${rec.slug}`,
              `record "${collName}/${rec.slug}" routed at both "${recordUrls.get(rec)}" and "${detailUrl}"`
            );
          } else {
            recordUrls.set(rec, detailUrl);
          }
          addRouteOrCollide(byUrl, routes, diagnostics, {
            url: detailUrl,
            kind: "record",
            target: targetId,
            sourcePath: `collections/${collName}/${rec.slug}`,
          });
        }
      }
    }
  }

  // 3) Redirects.
  // Source precedence: redirects singleton wins over manifest.redirects (§3.6 + §8.7).
  const manifestRedirects = Array.isArray(siteIndex.manifest && siteIndex.manifest.redirects)
    ? siteIndex.manifest.redirects
    : [];

  const singletonRedirectsRec = siteIndex.singletonsByName.get("redirects");
  let singletonRules = null;
  if (singletonRedirectsRec && singletonRedirectsRec.json && Array.isArray(singletonRedirectsRec.json.rules)) {
    singletonRules = singletonRedirectsRec.json.rules;
  }
  let effectiveRules = manifestRedirects;
  if (singletonRules) {
    effectiveRules = singletonRules;
    if (manifestRedirects.length > 0) {
      diagnostics.warning(
        "mosaic.redirect.duplicate-source",
        "mosaic.json",
        "both mosaic.json#redirects and redirects singleton exist; singleton wins"
      );
    }
  }

  // Dedupe by `from`, keep first, warn on duplicates.
  const seenFrom = new Map();
  const finalRules = [];
  for (const rule of effectiveRules) {
    if (!rule || typeof rule.from !== "string") continue;
    if (seenFrom.has(rule.from)) {
      diagnostics.warning(
        "mosaic.redirect.duplicate-from",
        "mosaic.json",
        `duplicate redirect from "${rule.from}"; keeping first`
      );
      continue;
    }
    seenFrom.set(rule.from, true);
    finalRules.push(rule);
  }

  // Detect explicit /home override.
  const explicitHomeOverride = finalRules.some((r) => r.from === "/home");

  // Add the automatic /home → / redirect unless explicitly overridden.
  if (!explicitHomeOverride) {
    finalRules.push({ from: "/home", to: "/", status: 301, _source: "auto" });
  }

  // Build redirect graph for loop detection.
  const fromToMap = new Map();
  for (const r of finalRules) {
    fromToMap.set(r.from, r.to);
  }

  for (const rule of finalRules) {
    // Check collision with non-redirect routes.
    const existing = byUrl.get(rule.from);
    if (existing && existing.kind !== "redirect") {
      diagnostics.structural(
        "mosaic.redirect.collision",
        "mosaic.json",
        `redirect "from" "${rule.from}" collides with a ${existing.kind} route`
      );
      continue;
    }
    // Check loops: follow from→to chain.
    if (hasLoop(rule.from, fromToMap)) {
      diagnostics.structural(
        "mosaic.redirect.loop",
        "mosaic.json",
        `redirect "${rule.from}" participates in a loop`
      );
      // Still emit the route entry below? Spec says structural → engine refuses index.
      // For the validator we still report routes (we don't gate emission of routes on structural errors).
    }

    const entry = {
      url: rule.from,
      kind: "redirect",
      target: rule.to,
    };
    if (!byUrl.has(rule.from)) {
      byUrl.set(rule.from, entry);
      routes.push(entry);
    }
  }

  return { routes, byUrl };
}

function addRouteOrCollide(byUrl, routes, diagnostics, entry) {
  const existing = byUrl.get(entry.url);
  if (!existing) {
    byUrl.set(entry.url, entry);
    routes.push(entry);
    return;
  }
  // Same URL — is it the same target?
  if (existing.kind === entry.kind && existing.target === entry.target) {
    return; // shared route, no collision
  }
  diagnostics.structural(
    "mosaic.route.collision",
    entry.sourcePath || entry.url,
    `route "${entry.url}" claimed by multiple sources`
  );
}

function hasLoop(start, fromToMap) {
  let cursor = start;
  const seen = new Set();
  for (let i = 0; i < 64; i++) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    if (!fromToMap.has(cursor)) return false;
    cursor = fromToMap.get(cursor);
  }
  return true; // suspiciously long chain → treat as loop
}

module.exports = { buildRoutes };
