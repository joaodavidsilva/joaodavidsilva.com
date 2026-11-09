import { getCollection, type CollectionEntry } from 'astro:content';
import { RESERVED_PATHS, SITE_URL } from '../../site.config.mjs';
import { lastUpdatedOf } from './git';
import { assertTranslations } from './translations';

export type Page = CollectionEntry<'pages'>;

/** URL path segments for a page: `index` is the root, `a/b` is `/a/b/`. */
export function slugOf(page: Page): string | undefined {
  return page.id === 'index' ? undefined : page.id.replace(/\/index$/, '');
}

export function pathOf(page: Page): string {
  const slug = slugOf(page);
  return slug ? `/${slug}/` : '/';
}

export function twinPathOf(page: Page): string {
  const slug = slugOf(page);
  return slug ? `/${slug}.md` : '/index.md';
}

export function canonicalOf(page: Page): string {
  return new URL(pathOf(page), SITE_URL).href;
}

/** Every page, after enforcing that none claims a reserved path and every Translation holds. */
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
  assertTranslations(pages);
  return pages;
}

/** The metadata shared by the JSON-LD and the Markdown twin front-matter. */
export function metadataOf(page: Page) {
  const { title, summary, published, language, tags } = page.data;
  const publishedDay = published.toISOString().slice(0, 10);
  return {
    title,
    summary,
    published: publishedDay,
    updated: lastUpdatedOf(page.filePath!, publishedDay),
    language,
    tags,
    canonical: canonicalOf(page),
  };
}
