import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, twinPathOf } from '../lib/pages';

export const GET: APIRoute = async () => {
  const pages = (await getPages()).filter((page) => page.data.language === 'en');
  const lines = pages
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((page) => `- [${page.data.title}](${new URL(twinPathOf(page), SITE_URL).href}): ${page.data.summary}`);
  const body = [
    '# João David Silva',
    '',
    '> Engineering beyond implementation. An independent engineering publication.',
    '',
    '## Pages',
    '',
    ...lines,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
