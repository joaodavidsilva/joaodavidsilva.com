import type { APIRoute, GetStaticPaths } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { ABOUT_PATH, ABOUT_TITLE, aboutMarkdown, getRecord, type Record } from '../lib/record';

export const getStaticPaths = (async () => {
  const record = await getRecord();
  return record ? [{ params: { about: 'about' }, props: { record } }] : [];
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { record } = props as { record: Record };
  const frontMatter = [
    '---',
    `title: ${JSON.stringify(ABOUT_TITLE)}`,
    `summary: ${JSON.stringify(`${record.name}. ${record.headline}`)}`,
    'language: en',
    `canonical: ${new URL(ABOUT_PATH, SITE_URL).href}`,
    '---',
  ].join('\n');
  return new Response(`${frontMatter}\n\n${aboutMarkdown(record)}`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
