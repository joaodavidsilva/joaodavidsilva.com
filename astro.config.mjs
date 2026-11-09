import { defineConfig } from 'astro/config';
import { SITE_URL } from './site.config.mjs';

// JDS_OUT_DIR lets the fixture build tests emit into a scratch directory.
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  outDir: process.env.JDS_OUT_DIR ?? './dist',
});
