import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://howlcipher.github.io',
  base: '/bullpenphone',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [preact(), sitemap()],
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self' https://statsapi.mlb.com https://public.api.bsky.app https://raw.githubusercontent.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
    },
  },
});
