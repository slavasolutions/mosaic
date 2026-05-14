// integration.js
//
// The Astro integration object. Hooks:
//
//   astro:config:setup
//     - resolve site path
//     - load + validate Mosaic site
//     - abort on structural errors
//     - injectRoute() for every page and record route
//     - configure redirects via updateConfig
//     - inject a Vite virtual module so the runtime helper can `import`
//       the parsed site without going through the filesystem at request time
//
//   astro:server:setup
//     - re-load on Mosaic file changes during dev
//
// Embedded mode (SPEC §0.2): Astro owns routing. We simply surface
// Mosaic's route table to Astro.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { loadSite } from './load-site.js';
import { buildAstroRoutes } from './routes.js';

const VIRTUAL_ID = 'virtual:mosaic-site';
const RESOLVED_VIRTUAL_ID = '\0virtual:mosaic-site';

export function createMosaicIntegration(options = {}) {
  if (!options.site) {
    throw new Error('@mosaic/astro-adapter: `site` option is required (path to the Mosaic folder).');
  }

  let parsedSite = null;
  let siteAbsPath = null;

  return {
    name: '@mosaic/astro-adapter',
    hooks: {
      'astro:config:setup': async ({
        config,
        injectRoute,
        updateConfig,
        logger,
        command
      }) => {
        // Resolve site path relative to the Astro project root.
        const projectRoot = fileURLToPath(config.root);
        siteAbsPath = path.resolve(projectRoot, options.site);

        logger.info(`[mosaic] loading site from ${siteAbsPath}`);
        parsedSite = await loadSite(siteAbsPath);

        const structural = parsedSite.diagnostics.filter((d) => d.severity === 'structural');
        if (structural.length > 0) {
          for (const d of structural) {
            logger.error(`[mosaic] ${d.code} @ ${d.source}: ${d.message}`);
          }
          throw new Error(`@mosaic/astro-adapter: ${structural.length} structural error(s) in Mosaic site; aborting.`);
        }
        const drift = parsedSite.diagnostics.filter((d) => d.severity === 'drift');
        const warn = parsedSite.diagnostics.filter((d) => d.severity === 'warning');
        for (const d of drift) logger.warn(`[mosaic] ${d.code} @ ${d.source}: ${d.message}`);
        for (const d of warn) logger.info(`[mosaic] ${d.code} @ ${d.source}: ${d.message}`);

        // Locate the catch-all entrypoint in the user's project.
        const catchAllCandidates = [
          'src/pages/[...slug].astro',
          'src/pages/[...mosaic].astro'
        ];
        let catchAllEntrypoint = null;
        for (const rel of catchAllCandidates) {
          const abs = path.join(projectRoot, rel);
          try { await fs.access(abs); catchAllEntrypoint = abs; break; } catch {}
        }
        if (!catchAllEntrypoint) {
          throw new Error('@mosaic/astro-adapter: expected a catch-all page at src/pages/[...slug].astro');
        }

        const { pageEntries, redirects } = buildAstroRoutes(parsedSite, {
          base: options.base || '/',
          catchAllEntrypoint
        });

        for (const r of pageEntries) {
          injectRoute({
            pattern: r.pattern,
            entrypoint: r.entrypoint,
            prerender: true
          });
        }

        // Astro's `redirects` is a config field; merge into it.
        updateConfig({
          redirects,
          vite: virtualModulePlugin({ getSite: () => publicSnapshot(parsedSite) })
        });

        logger.info(`[mosaic] injected ${pageEntries.length} routes, ${Object.keys(redirects).length} redirects`);
      },

      'astro:server:setup': async ({ server, logger }) => {
        // Cheap dev experience: any change under the Mosaic folder triggers
        // a full module-graph invalidate so the next request reloads.
        if (!siteAbsPath) return;
        const watcher = server.watcher;
        watcher.add(siteAbsPath);
        watcher.on('change', async (file) => {
          if (!file.startsWith(siteAbsPath)) return;
          try {
            parsedSite = await loadSite(siteAbsPath);
            const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: 'full-reload' });
            logger.info(`[mosaic] reloaded after change in ${path.relative(siteAbsPath, file)}`);
          } catch (err) {
            logger.error(`[mosaic] reload failed: ${err.message}`);
          }
        });
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Vite virtual module — exposes the parsed site to .astro pages
// ---------------------------------------------------------------------------

function virtualModulePlugin({ getSite }) {
  return {
    plugins: [
      {
        name: '@mosaic/astro-adapter:virtual',
        resolveId(id) {
          if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
          return null;
        },
        load(id) {
          if (id !== RESOLVED_VIRTUAL_ID) return null;
          const snap = getSite();
          return `export const site = ${JSON.stringify(snap)};\nexport default site;\n`;
        }
      }
    ]
  };
}

function publicSnapshot(site) {
  // Drop diagnostics from the runtime snapshot — they're build-time info.
  // Keep everything else verbatim.
  const { diagnostics, ...rest } = site;
  return rest;
}
