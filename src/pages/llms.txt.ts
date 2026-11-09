import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, twinPathOf } from '../lib/pages';
import * as writing from '../lib/articles';

export const GET: APIRoute = async () => {
  const pages = (await getPages()).filter((page) => page.data.language === 'en');
  const lines = pages
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((page) => `- [${page.data.title}](${new URL(twinPathOf(page), SITE_URL).href}): ${page.data.summary}`);
  const articles = (await writing.getArticles()).filter((article) => article.data.language === 'en');
  const writingLines = [
    `- [${writing.WRITING.title}](${new URL(writing.WRITING.twin, SITE_URL).href}): ${writing.WRITING.summary}`,
    ...articles.map(
      (article) => `- [${article.data.title}](${new URL(writing.twinPathOf(article), SITE_URL).href}): ${article.data.summary}`,
    ),
  ];
  const body = [
    '# João David Silva',
    '',
    '> Engineering beyond implementation. An independent engineering publication.',
    '',
    '## Pages',
    '',
    ...lines,
    '',
    '## Writing',
    '',
    ...writingLines,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
