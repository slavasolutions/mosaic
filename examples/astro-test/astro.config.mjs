import { defineConfig } from 'astro/config';
import mosaic from '@mosaic/astro-adapter';

// Wire up the Mosaic adapter against the canonical 0.8 example.
// All routes/redirects come from the Mosaic index; this Astro config
// stays empty of route declarations.
export default defineConfig({
  integrations: [
    mosaic({
      site: '../hromada-community',
      base: '/'
    })
  ]
});
