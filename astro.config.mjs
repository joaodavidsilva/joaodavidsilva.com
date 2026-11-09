import { defineConfig } from 'astro/config';
import { SITE_URL } from './site.config.mjs';
import { fontsourceVariable } from './src/lib/self-hosted-fonts.mjs';

const selfHosted = fontsourceVariable();
const subsets = ['latin', 'latin-ext'];

// JDS_OUT_DIR lets the fixture build tests emit into a scratch directory.
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  outDir: process.env.JDS_OUT_DIR ?? './dist',
  fonts: [
    {
      provider: selfHosted,
      name: 'Source Serif 4',
      cssVariable: '--font-serif',
      styles: ['normal', 'italic'],
      subsets,
      display: 'swap',
      fallbacks: ['serif'],
    },
    {
      provider: selfHosted,
      name: 'Inter',
      cssVariable: '--font-sans',
      styles: ['normal'],
      subsets,
      display: 'swap',
      fallbacks: ['sans-serif'],
    },
    {
      provider: selfHosted,
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      styles: ['normal'],
      subsets,
      display: 'swap',
      fallbacks: ['monospace'],
    },
  ],
});
