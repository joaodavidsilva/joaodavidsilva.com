import type { APIRoute } from 'astro';
import { attachmentsOf, correctionsOf, discussOf, metadataOf, type Article } from '../../../lib/articles';
import { articleRoutes } from '../../../lib/routes';
import type { Position } from '../../../lib/series';
import { absolute, translationFields, type Translations } from '../../../lib/translations';
import { markdownResponse } from '../../../lib/twin';
import { uiOf } from '../../../lib/ui';

export const getStaticPaths = articleRoutes;

/**
 * The Article's Markdown twin: its front-matter, its body, then its end matter as on the
 * page. A part of a Series states its position under the title and links its neighbours.
 */
export const GET: APIRoute<{ article: Article; position?: Position; translations: Translations }> = ({
  props: { article, position, translations },
}) => {
  const meta = metadataOf(article);
  const ui = uiOf(meta.language);
  const discuss = discussOf(article);
  const attachments = attachmentsOf(article);
  const corrections = correctionsOf(article);
  const fields = {
    ...meta,
    discuss: discuss.length > 0 ? Object.fromEntries(discuss.map(({ network, href }) => [network.toLowerCase(), href])) : undefined,
    series: position && {
      title: position.series.title,
      canonical: position.series.canonical,
      part: position.part,
      of: position.of,
    },
    ...translationFields(translations),
  };
  const neighbours = position && [
    ...(position.previous ? [`- ${ui.previous}: [${position.previous.title}](${absolute(position.previous.twin)})`] : []),
    ...(position.next ? [`- ${ui.next}: [${position.next.title}](${absolute(position.next.twin)})`] : []),
  ];
  return markdownResponse(fields, [
    `# ${meta.title}`,
    position && `${ui.part(position.part, position.of)} · [${position.series.title}](${absolute(position.series.twin)})`,
    (article.body ?? '').trim(),
    neighbours && neighbours.length > 0 && `## ${ui.series}: ${position!.series.title}\n\n${neighbours.join('\n')}`,
    attachments.length > 0 &&
      `## ${ui.attachments}\n\n${attachments.map(({ title, path, description }) => `- [${title}](${absolute(path)}) (${description})`).join('\n')}`,
    corrections.length > 0 && `## ${ui.corrections}\n\n${corrections.map(({ date, note }) => `- ${date}: ${note}`).join('\n')}`,
  ]);
};
