import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, twinPathOf } from '../lib/pages';
import * as writing from '../lib/articles';
import * as research from '../lib/studies';
import * as projects from '../lib/projects';
import { getKnowledge, twinPathOf as knowledgeTwinPathOf } from '../lib/knowledge';
import { getNow, NOW } from '../lib/now';
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
  const articles = (await writing.getArticles()).map(
    (article) => `- [${article.data.title}](${new URL(writing.twinPathOf(article), SITE_URL).href}): ${article.data.summary}`,
  );
  const writingIndex = `- [${writing.WRITING.title}](${new URL(writing.WRITING.twin, SITE_URL).href}): ${writing.WRITING.summary}`;
  const studies = (await research.getStudies()).map(
    (study) =>
      `- [${study.data.title}](${new URL(research.twinPathOf(study), SITE_URL).href}): ${study.data.summary} (${study.data.status})`,
  );
  const researchIndex = `- [${research.RESEARCH.title}](${new URL(research.RESEARCH.twin, SITE_URL).href}): ${research.RESEARCH.summary}`;
  const projectList = await projects.getProjects();
  const projectLines = [
    `- [${projects.PROJECTS_TITLE}](${new URL(projects.PROJECTS_TWIN_PATH, SITE_URL).href}): ${projects.PROJECTS_SUMMARY}`,
    ...projectList.map((project) => `- [${project.data.name}](${new URL(projects.twinPathOf(project), SITE_URL).href}): ${project.data.oneLine}`),
  ];
  const knowledge = (await getKnowledge())
    .filter(({ entry }) => entry.data.language === 'en')
    .map(({ entry }) => `- [${entry.data.title}](${new URL(knowledgeTwinPathOf(entry), SITE_URL).href}): ${entry.data.summary}`);
  if (await getNow()) lines.push(`- [${NOW.title}](${new URL(NOW.twin, SITE_URL).href}): ${NOW.summary}`);
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
    ...(articles.length ? ['## Writing', '', writingIndex, ...articles, ''] : []),
    ...(studies.length ? ['## Research', '', researchIndex, ...studies, ''] : []),
    ...(projectList.length ? ['## Projects', '', ...projectLines, ''] : []),
    ...(knowledge.length ? ['## Knowledge', '', ...knowledge, ''] : []),
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
