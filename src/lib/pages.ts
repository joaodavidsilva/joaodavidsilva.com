import { getCollection, type CollectionEntry } from 'astro:content';
import { RESERVED_PATHS } from '../../site.config.mjs';
import * as shared from './metadata';
import { assertTranslations, locate, translationsOf as translationsAmong } from './translations';

export type Page = CollectionEntry<'pages'>;

/** Where the page with id `id` is published: `index` is the root, `a/b` is `/a/b/`. */
const pagePathOf = (id: string) => (id === 'index' ? '/' : `/${id}/`);

export const pathOf = (page: Page) => locate(page, pagePathOf).path;
export const twinPathOf = (page: Page) => locate(page, pagePathOf).twin;
export const canonicalOf = (page: Page) => locate(page, pagePathOf).canonical;
export const translationsOf = (page: Page, pages: Page[]) => translationsAmong(page, pages, pagePathOf);

/** URL path segments for a page: undefined for the root. */
export const slugOf = (page: Page): string | undefined => pathOf(page).slice(1, -1) || undefined;

/** Every page and Translation, after enforcing that none claims a reserved path and every Translation holds. */
export async function getPages(): Promise<Page[]> {
  const pages = await getCollection('pages');
  for (const page of pages) {
    const first = slugOf(page)?.split('/')[0];
    if (first && RESERVED_PATHS.includes(first)) {
      throw new Error(
        `${page.filePath}: path "/${first}/" is reserved for a project with its own site`,
      );
    }
  }
  assertTranslations(pages, { pathOf: pagePathOf });
  return pages;
}

/** The metadata shared by the JSON-LD and the Markdown twin front-matter. */
export const metadataOf = (page: Page) =>
  shared.metadataOf(page, pagePathOf, { title: page.data.title, summary: page.data.summary });
