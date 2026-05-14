// Route table builder: pages, collection-list mounts, redirects.
// Emits: route.collision, collection.missing, redirect.loop,
// redirect.collision, redirect.duplicate-from, redirect.duplicate-source.

export function buildRoutes(site, diagnostics) {
  // Returns { routes: [...], byUrl: Map }, mutates site.recordUrls
  // and site.routedCollections.
  const routes = [];
  const byUrl = new Map();
  const recordUrls = site.recordUrls;
  const routedCollections = site.routedCollections;

  // 1) Pages.
  for (const pageRec of site.pages) {
    const url = pageRec._url;
    if (!url) continue;
    addRouteOrCollide(byUrl, routes, diagnostics, {
      url,
      kind: "page",
      target: pageRec.sourcePath,
      sourcePath: pageRec.sourcePath,
    });
  }

  // 2) Collection-list mounts.
  for (const pageRec of site.pages) {
    const sections = (pageRec.json && Array.isArray(pageRec.json.sections)) ? pageRec.json.sections : [];
    for (const sec of sections) {
      if (!sec || sec.type !== "collection-list") continue;
      const from = typeof sec.from === "string" ? sec.from : null;
      if (!from) continue;
      let collName = null;
      if (from.startsWith("collections/")) {
        collName = from.slice("collections/".length);
        if (collName.endsWith("/")) collName = collName.slice(0, -1);
      }
      const coll = collName ? site.collectionsByName.get(collName) : null;
      if (!coll) {
        diagnostics.structural(
          "mosaic.collection.missing",
          pageRec.sourcePath,
          `collection-list references non-existent "${from}"`,
        );
        continue;
      }
      const routesEnabled = sec.routes !== false;
      const pageUrl = pageRec._url;
      const urlPattern = typeof sec.urlPattern === "string"
        ? sec.urlPattern
        : (pageUrl === "/" ? "/{slug}" : pageUrl + "/{slug}");

      if (routesEnabled) {
        routedCollections.add(collName);
        for (const rec of coll.records) {
          const detailUrl = urlPattern.replace(/\{slug\}/g, rec.slug);
          const targetId = `record:${collName}/${rec.slug}`;
          if (recordUrls.has(rec) && recordUrls.get(rec) !== detailUrl) {
            diagnostics.structural(
              "mosaic.route.collision",
              `collections/${collName}/${rec.slug}`,
              `record "${collName}/${rec.slug}" routed at both "${recordUrls.get(rec)}" and "${detailUrl}"`,
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

  // 3) Redirects: singleton wins over manifest.
  const manifestRedirects = Array.isArray(site.manifest && site.manifest.redirects)
    ? site.manifest.redirects
    : [];
  const singletonRedirectsRec = site.singletonsByName.get("redirects");
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
        "both mosaic.json#redirects and redirects singleton exist; singleton wins",
      );
    }
  }

  const seenFrom = new Map();
  const finalRules = [];
  for (const rule of effectiveRules) {
    if (!rule || typeof rule.from !== "string") continue;
    if (seenFrom.has(rule.from)) {
      diagnostics.warning(
        "mosaic.redirect.duplicate-from",
        "mosaic.json",
        `duplicate redirect from "${rule.from}"; keeping first`,
      );
      continue;
    }
    seenFrom.set(rule.from, true);
    finalRules.push(rule);
  }

  const explicitHomeOverride = finalRules.some((r) => r.from === "/home");
  if (!explicitHomeOverride) {
    finalRules.push({ from: "/home", to: "/", status: 301, _source: "auto" });
  }

  const fromToMap = new Map();
  for (const r of finalRules) fromToMap.set(r.from, r.to);

  const cycledNodes = new Set();
  for (const rule of finalRules) {
    if (cycledNodes.has(rule.from)) continue;
    const cycle = findCycle(rule.from, fromToMap);
    if (cycle) {
      diagnostics.structural(
        "mosaic.redirect.loop",
        "mosaic.json",
        `redirect cycle: ${cycle.join(" -> ")}`,
      );
      for (const node of cycle) cycledNodes.add(node);
    }
  }

  const builtRedirects = [];
  for (const rule of finalRules) {
    const existing = byUrl.get(rule.from);
    if (existing && existing.kind !== "redirect") {
      diagnostics.structural(
        "mosaic.redirect.collision",
        "mosaic.json",
        `redirect "from" "${rule.from}" collides with a ${existing.kind} route`,
      );
      continue;
    }
    const entry = { url: rule.from, kind: "redirect", target: rule.to };
    if (!byUrl.has(rule.from)) {
      byUrl.set(rule.from, entry);
      routes.push(entry);
    }
    builtRedirects.push({
      from: rule.from,
      to: rule.to,
      status: typeof rule.status === "number" ? rule.status : 301,
      source: rule._source || (singletonRules ? "singleton" : "manifest"),
    });
  }

  return { routes, byUrl, redirects: builtRedirects };
}

function addRouteOrCollide(byUrl, routes, diagnostics, entry) {
  const existing = byUrl.get(entry.url);
  if (!existing) {
    byUrl.set(entry.url, entry);
    routes.push(entry);
    return;
  }
  if (existing.kind === entry.kind && existing.target === entry.target) return;
  diagnostics.structural(
    "mosaic.route.collision",
    entry.sourcePath || entry.url,
    `route "${entry.url}" claimed by multiple sources`,
  );
}

function findCycle(start, fromToMap) {
  let cursor = start;
  const order = [];
  const seenIndex = new Map();
  while (cursor !== undefined && cursor !== null) {
    if (seenIndex.has(cursor)) return order.slice(seenIndex.get(cursor));
    seenIndex.set(cursor, order.length);
    order.push(cursor);
    if (!fromToMap.has(cursor)) return null;
    cursor = fromToMap.get(cursor);
    if (order.length > 64) return order;
  }
  return null;
}
