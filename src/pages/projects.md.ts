import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getProjects, metadataOf, pathOf, PROJECTS_PATH, PROJECTS_SUMMARY, PROJECTS_TITLE } from '../lib/projects';
import { ORIGINAL_LANGUAGE } from '../lib/translations';

const yamlString = (value: string) => JSON.stringify(value);

export const GET: APIRoute = async () => {
  const projects = await getProjects();
  const updated = projects.map((project) => metadataOf(project).updated).sort().at(-1);
  const frontMatter = [
    '---',
    `title: ${yamlString(PROJECTS_TITLE)}`,
    `summary: ${yamlString(PROJECTS_SUMMARY)}`,
    ...(updated ? [`updated: ${updated}`] : []),
    `language: ${ORIGINAL_LANGUAGE}`,
    `canonical: ${new URL(PROJECTS_PATH, SITE_URL).href}`,
    '---',
  ].join('\n');
  const list = projects.map((project) => {
    const { name, status, version, oneLine } = project.data;
    const facts = version ? `${status}, version ${version}` : status;
    return `- [${name}](${pathOf(project)}) (${facts}): ${oneLine}`;
  });
  return new Response(`${frontMatter}\n\n# ${PROJECTS_TITLE}\n\n${PROJECTS_SUMMARY}\n\n${list.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
