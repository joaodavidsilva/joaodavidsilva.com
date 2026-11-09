import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, twinPathOf } from '../lib/pages';
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
