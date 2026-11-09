import type { APIRoute, GetStaticPaths } from 'astro';
import { getPages, metadataOf, twinPathOf, type Page } from '../lib/pages';

export const getStaticPaths = (async () => {
  const pages = await getPages();
  return pages.map((page) => ({
    params: { slug: twinPathOf(page).slice(1, -'.md'.length) },
    props: { page },
  }));
}) satisfies GetStaticPaths;

const yamlString = (value: string) => JSON.stringify(value);

export const GET: APIRoute = ({ props }) => {
  const page = (props as { page: Page }).page;
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
    '---',
  ].join('\n');
  return new Response(`${frontMatter}\n\n# ${meta.title}\n\n${(page.body ?? '').trim()}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
