import type { APIRoute, GetStaticPaths } from 'astro';
import { getPages, metadataOf, twinPathOf, type Page } from '../lib/pages';
import { translationsOf, type Translations } from '../lib/translations';

export const getStaticPaths = (async () => {
  const pages = await getPages();
  return pages.map((page) => ({
    params: { slug: twinPathOf(page).slice(1, -'.md'.length) },
    props: { page, translations: translationsOf(page, pages) },
  }));
}) satisfies GetStaticPaths;

const yamlString = (value: string) => JSON.stringify(value);

export const GET: APIRoute = ({ props }) => {
  const { page, translations } = props as { page: Page; translations: Translations };
  const meta = metadataOf(page);
  const frontMatter = [
    '---',
    `title: ${yamlString(meta.title)}`,
    `summary: ${yamlString(meta.summary)}`,
    `published: ${meta.published}`,
    `updated: ${meta.updated}`,
    `language: ${meta.language}`,
    `tags: [${meta.tags.map(yamlString).join(', ')}]`,
    `canonical: ${meta.canonical}`,
    ...(translations.original ? [`original: ${translations.original.canonical}`, `outdated: ${translations.outdated}`] : []),
    '---',
  ].join('\n');
  return new Response(`${frontMatter}\n\n# ${meta.title}\n\n${(page.body ?? '').trim()}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
