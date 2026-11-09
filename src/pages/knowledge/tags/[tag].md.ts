import type { APIRoute, GetStaticPaths } from 'astro';
import { getKnowledge, markdownList, slugify, tagsOf, type KnowledgeEntry } from '../../../lib/knowledge';
import { SITE_URL } from '../../../../site.config.mjs';

export const getStaticPaths = (async () => {
  const entries = await getKnowledge();
  return tagsOf(entries).map((tag) => ({
    params: { tag: slugify(tag) },
    props: { tag, entries: entries.filter(({ entry }) => entry.data.tags.includes(tag)) },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { tag, entries } = props as { tag: string; entries: KnowledgeEntry[] };
  const body = [
    '---',
    `title: ${JSON.stringify(`Knowledge: ${tag}`)}`,
    'language: en',
    `canonical: ${new URL(`/knowledge/tags/${slugify(tag)}/`, SITE_URL).href}`,
    '---',
    '',
    `# Knowledge tagged “${tag}”`,
    '',
    markdownList(entries),
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
