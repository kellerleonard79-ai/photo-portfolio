// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Set this to the real custom domain once it's chosen (§9 open question) — it is
// used for the sitemap, canonical URLs, and Open Graph absolute URLs.
const SITE = 'https://kellerleonard.com';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  // Pure static output (§2). Everything is prerendered in Node at build, so the
  // sharp pipeline — responsive widths + AVIF/WebP (§4) and the build-time LQIP
  // in src/lib/series.ts — runs normally. No server runtime, no adapter.
  //
  // Deployed as static assets from `dist/` (see wrangler.jsonc). This is the
  // Cloudflare-Pages-equivalent path on a Workers project: no `_worker.js`.
  output: 'static',
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  integrations: [sitemap()],
});
