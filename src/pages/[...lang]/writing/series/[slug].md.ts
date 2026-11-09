import type { APIRoute } from 'astro';
import { seriesRoutes } from '../../../../lib/routes';
import { metadataOf, partsOf, type Series } from '../../../../lib/series';
import { absolute, translationFields } from '../../../../lib/translations';
import { markdownResponse } from '../../../../lib/twin';
import { uiOf } from '../../../../lib/ui';

export const getStaticPaths = seriesRoutes;

/** The Series' Markdown twin: its introduction, then every part in order, so an agent can read the whole Series. */
export const GET: APIRoute<{ series: Series }> = ({ props: { series } }) => {
  const meta = metadataOf(series);
  const ui = uiOf(meta.language);
  const parts = partsOf(series);
  return markdownResponse({ ...meta, tags: [], ...translationFields(series.translations) }, [
    `# ${meta.title}`,
    `${ui.seriesStatus[meta.status]}, ${ui.parts(parts.length)}.`,
    (series.entry.body ?? '').trim(),
    `## ${ui.partsHeading}`,
    parts.length > 0
      ? parts.map(({ part, title, twin, published, summary }) => `${part}. [${title}](${absolute(twin)}) (${published}): ${summary}`).join('\n')
      : ui.noParts,
  ]);
};
