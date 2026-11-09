import type { APIRoute } from 'astro';
import { getProjects, indexMetadataOf, projectsIndexOf, twinPathOf } from '../../lib/projects';
import { languageParams } from '../../lib/sections';
import { absolute, type Language } from '../../lib/translations';
import { markdownResponse } from '../../lib/twin';

export const getStaticPaths = () => languageParams('projects');

export const GET: APIRoute = async ({ props }) => {
  const { language } = props as { language: Language };
  const index = projectsIndexOf(language);
  const projects = await getProjects(language);
  const list = projects.map((project) => {
    const { name, status, version, oneLine } = project.data;
    const facts = version ? `${status}, version ${version}` : status;
    return `- [${name}](${absolute(twinPathOf(project))}) (${facts}): ${oneLine}`;
  });
  return markdownResponse(indexMetadataOf(language, projects), [`# ${index.title}`, index.summary, list.join('\n')]);
};
