import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, twinPathOf } from '../lib/pages';
import * as projects from '../lib/projects';
import { ABOUT_TITLE, getRecord } from '../lib/record';

export const GET: APIRoute = async () => {
  const pages = (await getPages()).filter((page) => page.data.language === 'en');
  const lines = pages
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((page) => `- [${page.data.title}](${new URL(twinPathOf(page), SITE_URL).href}): ${page.data.summary}`);
  const projectLines = [
    `- [${projects.PROJECTS_TITLE}](${new URL(projects.PROJECTS_TWIN_PATH, SITE_URL).href}): ${projects.PROJECTS_SUMMARY}`,
    ...(await projects.getProjects())
      .filter((project) => project.data.language === 'en')
      .map((project) => `- [${project.data.name}](${new URL(projects.twinPathOf(project), SITE_URL).href}): ${project.data.oneLine}`),
  ];
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
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
