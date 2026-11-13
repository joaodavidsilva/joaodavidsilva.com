import type { APIRoute } from 'astro';
import { getProjectListings, indexMetadataOf, projectsIndexOf, twinPathOf } from '../../lib/projects';
import { languageParams } from '../../lib/sections';
import { absolute, type Language } from '../../lib/translations';
import { markdownResponse } from '../../lib/twin';
import { uiOf } from '../../lib/ui';

export const getStaticPaths = () => languageParams('projects');

export const GET: APIRoute = async ({ props }) => {
  const { language } = props as { language: Language };
  const index = projectsIndexOf(language);
  const ui = uiOf(language);
  const projects = await getProjectListings(language);
  const list = projects.map((project) => {
    const { name, status, version, oneLine, external } = project.data;
    const facts = [status, version && `version ${version}`, external && ui.redesign.ownSite].filter(Boolean).join(', ');
    return external
      ? `- ${name} (${facts}): ${oneLine}`
      : `- [${name}](${absolute(twinPathOf(project))}) (${facts}): ${oneLine}`;
  });
  return markdownResponse(indexMetadataOf(language, projects), [`# ${index.title}`, index.summary, list.join('\n')]);
};
