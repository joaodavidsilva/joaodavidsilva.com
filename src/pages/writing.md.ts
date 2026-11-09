import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getArticles, metadataOf, twinPathOf, WRITING } from '../lib/articles';
import { getSeries, metadataOf as seriesMetadataOf, twinPathOf as seriesTwinPathOf } from '../lib/series';

/** The Writing index's Markdown twin: every Article, newest first, then every Series. */
export const GET: APIRoute = async () => {
  const articles = (await getArticles()).map((article) => ({ twin: twinPathOf(article), ...metadataOf(article) }));
  const series = (await getSeries()).map((one) => ({ twin: seriesTwinPathOf(one), parts: one.parts.length, ...seriesMetadataOf(one) }));
  const frontMatter = [
    '---',
    `title: ${JSON.stringify(WRITING.title)}`,
    `summary: ${JSON.stringify(WRITING.summary)}`,
    ...(articles.length > 0
      ? [`published: ${articles.at(-1)!.published}`, `updated: ${articles.map((a) => a.updated).sort().at(-1)}`]
      : []),
    'language: en',
    'tags: []',
    `canonical: ${WRITING.canonical}`,
    '---',
  ];
  const list = articles.map(
    ({ title, twin, published, summary }) => `- [${title}](${new URL(twin, SITE_URL).href}) (${published}): ${summary}`,
  );
  const seriesList = series.map(
    ({ title, twin, status, parts, summary }) =>
      `- [${title}](${new URL(twin, SITE_URL).href}) (${status}, ${parts === 1 ? '1 part' : `${parts} parts`}): ${summary}`,
  );
  const body = [
    `# ${WRITING.title}`,
    WRITING.summary,
    ...(list.length > 0 ? [list.join('\n')] : []),
    ...(seriesList.length > 0 ? ['## Series', seriesList.join('\n')] : []),
  ];
  return new Response(`${frontMatter.join('\n')}\n\n${body.join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
