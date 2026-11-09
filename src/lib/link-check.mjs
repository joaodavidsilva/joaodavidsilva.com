import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESERVED_PATHS, SITE_URL } from '../../site.config.mjs';

const decode = (text) =>
  text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Every built HTML file under `dir`, as paths relative to it. */
function htmlFilesIn(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((file) => file.endsWith('.html'))
    .map((file) => file.split(sep).join('/'));
}

/** The URL path a built HTML file is served at: `a/b/index.html` is `/a/b/`. */
const pathOfFile = (file) => `/${file.replace(/(^|\/)index\.html$/, '$1')}`;

/**
 * Fails the build when a link in a page's content (`<main>`) points at a page,
 * file or fragment of this site that the build did not produce. The site chrome
 * is outside `<main>`: its links to sections are fixed and do not rot with content.
 * Paths reserved for Projects with their own sites are not this build's to check.
 */
export function linkCheck() {
  return {
    name: 'link-check',
    hooks: {
      'astro:build:done'({ dir }) {
        const outDir = fileURLToPath(dir);
        const pages = new Map(htmlFilesIn(outDir).map((file) => [pathOfFile(file), readFileSync(join(outDir, file), 'utf8')]));
        const idsCache = new Map();
        const idsOf = (path) => {
          if (!idsCache.has(path)) {
            idsCache.set(path, new Set([...pages.get(path).matchAll(/\s(?:id|name)="([^"]+)"/g)].map((m) => decode(m[1]))));
          }
          return idsCache.get(path);
        };
        /** The built page path for a URL path, or null when nothing was built there; files resolve to ''. */
        const targetOf = (path) => {
          if (pages.has(path)) return path;
          if (pages.has(`${path}/`)) return `${path}/`;
          const file = join(outDir, path);
          return existsSync(file) && statSync(file).isFile() ? '' : null;
        };

        const broken = [];
        for (const [page, html] of pages) {
          const main = html.match(/<main\b[^>]*>(.*)<\/main>/s)?.[1] ?? '';
          for (const [, raw] of main.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)) {
            const href = decode(raw);
            const url = new URL(href, new URL(page, SITE_URL));
            if (url.origin !== SITE_URL || RESERVED_PATHS.includes(url.pathname.split('/')[1])) continue;
            const path = decodeURIComponent(url.pathname);
            const target = targetOf(path);
            const fragment = decodeURIComponent(url.hash.slice(1));
            if (target === null || (fragment && target && !idsOf(target).has(fragment))) {
              broken.push(`${page} links to ${href}, which does not exist`);
            }
          }
        }
        if (broken.length > 0) {
          throw new Error(`Broken internal links:\n  ${broken.join('\n  ')}`);
        }
      },
    },
  };
}
