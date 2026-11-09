import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, twinPathOf } from '../lib/pages';
import * as writing from '../lib/articles';
import { getKnowledge, twinPathOf as knowledgeTwinPathOf } from '../lib/knowledge';
import { ABOUT_TITLE, getRecord } from '../lib/record';
import { ORIGINAL_LANGUAGE, translationsOf } from '../lib/translations';

export const GET: APIRoute = async () => {
  const pages = await getPages();
  const lines = pages
    .filter((page) => page.data.language === ORIGINAL_LANGUAGE)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((page) => {
      const translations = translationsOf(page, pages).versions.slice(1);
      const pointer = translations.length
        ? ` (Translations: ${translations.map((v) => `[${v.name}](${new URL(v.twin, SITE_URL).href})`).join(', ')})`
        : '';
      return `- [${page.data.title}](${new URL(twinPathOf(page), SITE_URL).href}): ${page.data.summary}${pointer}`;
    });
  const record = await getRecord();
  if (record) lines.push(`- [${ABOUT_TITLE}](${new URL('/about.md', SITE_URL).href}): ${record.name}. ${record.headline}`);
  const articles = (await writing.getArticles()).map(
    (article) => `- [${article.data.title}](${new URL(writing.twinPathOf(article), SITE_URL).href}): ${article.data.summary}`,
  );
  const writingIndex = `- [${writing.WRITING.title}](${new URL(writing.WRITING.twin, SITE_URL).href}): ${writing.WRITING.summary}`;
  const knowledge = (await getKnowledge())
    .filter(({ entry }) => entry.data.language === 'en')
    .map(({ entry }) => `- [${entry.data.title}](${new URL(knowledgeTwinPathOf(entry), SITE_URL).href}): ${entry.data.summary}`);
  const body = [
    '# João David Silva',
    '',
    '> Engineering beyond implementation. An independent engineering publication.',
    '',
    '## Pages',
    '',
    ...lines,
    '',
    ...(articles.length ? ['## Writing', '', writingIndex, ...articles, ''] : []),
    ...(knowledge.length ? ['## Knowledge', '', ...knowledge, ''] : []),
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
