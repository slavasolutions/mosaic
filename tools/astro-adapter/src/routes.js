// routes.js
//
// Turns a Mosaic index's route table into the list of Astro injectRoute()
// payloads. The catch-all is provided by the user's project; this module
// only enumerates the URLs Astro should pre-render and tells Astro which
// component handles each.

import path from 'node:path';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function buildAstroRoutes(site, options) {
  const { base = '/', catchAllEntrypoint } = options;

  const pageEntries = [];
  for (const [url, route] of Object.entries(site.routes)) {
    if (route.kind === 'page' || route.kind === 'record') {
      pageEntries.push({
        pattern: joinBase(base, url),
        entrypoint: catchAllEntrypoint,
        prerender: true
      });
    }
  }

  const redirects = {};
  for (const r of site.redirects) {
    redirects[joinBase(base, r.from)] = {
      status: r.status || 301,
      destination: r.to.startsWith('/') ? joinBase(base, r.to) : r.to
    };
  }

  return { pageEntries, redirects };
}

function joinBase(base, url) {
  if (base === '/' || base === '') return url;
  const cleanBase = base.replace(/\/$/, '');
  if (url === '/') return cleanBase || '/';
  return `${cleanBase}${url}`;
}

export { SLUG_RE };
