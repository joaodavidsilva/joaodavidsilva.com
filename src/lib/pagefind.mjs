import { fileURLToPath } from 'node:url';
import { createIndex } from 'pagefind';

/**
 * Builds the Pagefind search index over the built site once Astro has written it.
 * Only elements marked `data-pagefind-body` (Knowledge Base entries) are indexed.
 */
export function pagefind() {
  return {
    name: 'pagefind',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const { index, errors } = await createIndex();
        if (errors.length) throw new Error(`Pagefind: ${errors.join('; ')}`);
        const site = fileURLToPath(dir);
        const added = await index.addDirectory({ path: site });
        if (added.errors.length) throw new Error(`Pagefind: ${added.errors.join('; ')}`);
        const written = await index.writeFiles({ outputPath: `${site}/pagefind` });
        if (written.errors.length) throw new Error(`Pagefind: ${written.errors.join('; ')}`);
        logger.info(`indexed ${added.page_count} pages`);
      },
    },
  };
}
