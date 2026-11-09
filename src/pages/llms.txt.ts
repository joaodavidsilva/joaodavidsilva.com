import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, twinPathOf } from '../lib/pages';
import * as projects from '../lib/projects';
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
  const projectLines = [
    `- [${projects.PROJECTS_TITLE}](${new URL(projects.PROJECTS_TWIN_PATH, SITE_URL).href}): ${projects.PROJECTS_SUMMARY}`,
    ...(await projects.getProjects())
      .filter((project) => project.data.language === 'en')
      .map((project) => `- [${project.data.name}](${new URL(projects.twinPathOf(project), SITE_URL).href}): ${project.data.oneLine}`),
  ];
  const knowledge = (await getKnowledge())
    .filter(({ entry }) => entry.data.language === 'en')
    .map(({ entry }) => `- [${entry.data.title}](${new URL(knowledgeTwinPathOf(entry), SITE_URL).href}): ${entry.data.summary}`);
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
    '## Projects',
    '',
    ...projectLines,
    '',
    ...(knowledge.length ? ['## Knowledge', '', ...knowledge, ''] : []),
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
