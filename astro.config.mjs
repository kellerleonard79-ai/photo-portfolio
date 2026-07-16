// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The brief (§8) deploys the static `dist/` output to Cloudflare Pages.
// Set this to the real custom domain once it's chosen (§9 open question) —
// it is used for the sitemap, canonical URLs, and Open Graph absolute URLs.
const SITE = 'https://kellerleonard.com';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  // Static output. Zero client JS by default; sharp optimizes images at build.
  output: 'static',
  integrations: [sitemap()],
  image: {
    // Explicit sharp service — generates the responsive widths + AVIF/WebP the
    // image pipeline (§4) depends on.
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
});
