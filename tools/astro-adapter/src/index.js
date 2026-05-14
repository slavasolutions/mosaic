// @mosaic/astro-adapter
// Public entry. Consumed from a user's astro.config.mjs:
//
//   import mosaic from '@mosaic/astro-adapter';
//   export default defineConfig({ integrations: [mosaic({ site: '../mosaic-site' })] });
//
// The integration runs the Mosaic load pipeline at Astro startup, wires
// every routed page / record into Astro via injectRoute, and surfaces the
// parsed site to .astro pages through a runtime helper.
//
// Embedded-engine mode (SPEC §0.2): routing is owned by Astro; this
// integration just *publishes* the Mosaic route table to it.

import { createMosaicIntegration } from './integration.js';

export default function mosaic(options) {
  return createMosaicIntegration(options);
}

export { createMosaicIntegration };
export { loadSite } from './load-site.js';
