import type { APIRoute } from 'astro';
import { figuresOf, legalOf, linksOf, metadataOf, type Project } from '../../../lib/projects';
import { projectRoutes } from '../../../lib/routes';
import { absolute, translationFields, twinOf, type Translations } from '../../../lib/translations';
import { markdownResponse } from '../../../lib/twin';
import { uiOf } from '../../../lib/ui';

export const getStaticPaths = projectRoutes;

export const GET: APIRoute<{ project: Project; translations: Translations }> = async ({ props: { project, translations } }) => {
  const meta = metadataOf(project);
  const ui = uiOf(meta.language);
  const links = linksOf(project, ui);
  const legal = await legalOf(project);
  const figures = await figuresOf(project);
  return markdownResponse({ ...meta, ...translationFields(translations) }, [
    `# ${meta.title}`,
    meta.summary,
    `${ui.status}: ${meta.status}${meta.version ? `. ${ui.version}: ${meta.version}` : ''}.`,
    (project.body ?? '').trim(),
    figures.map((figure) => `![${figure.alt}](${figure.src})${figure.caption ? `\n\n${figure.caption}` : ''}`).join('\n\n'),
    project.data.waitlist &&
      `## Waitlist\n\nJoin the Waitlist with the form at ${meta.canonical}#waitlist (in a browser: a Turnstile bot check guards it).`,
    links.length > 0 && `## ${ui.links}\n\n${links.map((link) => `- [${link.label}](${link.url})`).join('\n')}`,
    legal.length > 0 && `## ${ui.legalDocuments}\n\n${legal.map((doc) => `- [${doc.title}](${absolute(twinOf(doc.path))})`).join('\n')}`,
  ]);
};
