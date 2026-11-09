import type { APIRoute } from 'astro';
import * as writing from '../../../lib/articles';
import { studyRoutes } from '../../../lib/routes';
import { linksOf, metadataOf, type Study } from '../../../lib/studies';
import { absolute, translationFields, type Translations } from '../../../lib/translations';
import { markdownResponse } from '../../../lib/twin';
import { uiOf } from '../../../lib/ui';

export const getStaticPaths = studyRoutes;

/** The Study's Markdown twin: its front-matter, its sections, then its end matter as on the page. */
export const GET: APIRoute<{ study: Study; discussedIn: writing.Article[]; translations: Translations }> = ({
  props: { study, discussedIn, translations },
}) => {
  const meta = metadataOf(study);
  const ui = uiOf(meta.language);
  const { data, scripts } = linksOf(study);
  const links = [
    ...data.map((link) => ({ kind: ui.data, ...link })),
    ...scripts.map((link) => ({ kind: ui.script, ...link })),
  ].map(({ kind, title, href, description }) => `- ${kind}: [${title}](${absolute(href)})${description ? ` (${description})` : ''}`);
  const citing = discussedIn.map((article) => {
    const { title, published } = writing.metadataOf(article);
    return `- [${title}](${absolute(writing.twinPathOf(article))}) (${published})`;
  });
  return markdownResponse({ ...meta, ...translationFields(translations) }, [
    `# ${meta.title}`,
    (study.body ?? '').trim(),
    links.length > 0 && `## ${ui.dataAndScripts}\n\n${links.join('\n')}`,
    citing.length > 0 && `## ${ui.discussedIn}\n\n${citing.join('\n')}`,
  ]);
};
