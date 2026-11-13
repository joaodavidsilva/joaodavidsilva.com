import { defineConfig } from 'astro/config';
import { SITE_URL } from './site.config.mjs';
import { pagefind } from './src/lib/pagefind.mjs';
import { fontsourceVariable } from './src/lib/self-hosted-fonts.mjs';
import { longFormMarkdown } from './src/lib/long-form-markdown.mjs';
import { linkCheck } from './src/lib/link-check.mjs';

const selfHosted = fontsourceVariable();
const subsets = ['latin', 'latin-ext'];

// JDS_OUT_DIR lets the fixture build tests emit into a scratch directory.
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  integrations: [longFormMarkdown(), pagefind(), linkCheck()],
  outDir: process.env.JDS_OUT_DIR ?? './dist',
  markdown: {
    // Token colours are CSS variables, mapped onto palette tokens in src/styles/long-form.css:
    // restrained, AA on the code surface, and following the System / Light / Dark theme.
    shikiConfig: { theme: 'css-variables' },
  },
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
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      styles: ['normal'],
      subsets,
      display: 'swap',
      fallbacks: ['monospace'],
    },
  ],
});
