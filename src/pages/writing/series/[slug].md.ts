import type { APIRoute, GetStaticPaths } from 'astro';
import { SITE_URL } from '../../../../site.config.mjs';
import { getSeries, metadataOf, partsOf, STATUS_LABELS, type Series } from '../../../lib/series';

export const getStaticPaths = (async () => {
  const series = await getSeries();
  return series.map((one) => ({ params: { slug: one.entry.id }, props: { series: one } }));
}) satisfies GetStaticPaths;

/** The Series' Markdown twin: its introduction, then every part in order, so an agent can read the whole Series. */
export const GET: APIRoute<{ series: Series }> = ({ props: { series } }) => {
  const meta = metadataOf(series);
  const parts = partsOf(series);
  const frontMatter = [
    '---',
    `title: ${JSON.stringify(meta.title)}`,
    `summary: ${JSON.stringify(meta.summary)}`,
    `published: ${meta.published}`,
    `updated: ${meta.updated}`,
    `language: ${meta.language}`,
    'tags: []',
    `canonical: ${meta.canonical}`,
    `status: ${meta.status}`,
    '---',
  ];
  const sections = [
    `# ${meta.title}`,
    `${STATUS_LABELS[meta.status]} Series, ${parts.length === 1 ? '1 part' : `${parts.length} parts`}.`,
    (series.entry.body ?? '').trim(),
    '## Parts',
    parts.length > 0
      ? parts
          .map(({ part, title, twin, published, summary }) => `${part}. [${title}](${new URL(twin, SITE_URL).href}) (${published}): ${summary}`)
          .join('\n')
      : 'No parts yet.',
  ];
  return new Response(`${frontMatter.join('\n')}\n\n${sections.join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
