import type { APIRoute, GetStaticPaths } from 'astro';
import { dateOf, getNow, NOW, type Now } from '../lib/now';

export const getStaticPaths = (async () => {
  const now = await getNow();
  return now ? [{ params: { now: 'now' }, props: { now } }] : [];
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { now } = props as { now: Now };
  const frontMatter = [
    '---',
    `title: ${JSON.stringify(NOW.title)}`,
    `summary: ${JSON.stringify(NOW.summary)}`,
    `updated: ${dateOf(now)}`,
    'language: en',
    `canonical: ${NOW.canonical}`,
    '---',
  ].join('\n');
  return new Response(`${frontMatter}\n\n# ${NOW.title}\n\nUpdated ${dateOf(now)}.\n\n${(now.body ?? '').trim()}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
