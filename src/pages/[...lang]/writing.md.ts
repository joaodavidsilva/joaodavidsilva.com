import type { APIRoute } from 'astro';
import { getArticles, metadataOf, twinPathOf, writingIndexOf } from '../../lib/articles';
import { languageParams } from '../../lib/sections';
import { getSeries, metadataOf as seriesMetadataOf, twinPathOf as seriesTwinPathOf } from '../../lib/series';
import { absolute, type Language } from '../../lib/translations';
import { markdownResponse } from '../../lib/twin';
import { uiOf } from '../../lib/ui';

export const getStaticPaths = () => languageParams('writing');

/** The Writing index's Markdown twin: every Article in its language, newest first, then every Series. */
export const GET: APIRoute = async ({ props }) => {
  const { language } = props as { language: Language };
  const ui = uiOf(language);
  const index = writingIndexOf(language);
  const articles = (await getArticles(language)).map((article) => ({ twin: twinPathOf(article), ...metadataOf(article) }));
  const series = (await getSeries(language))
    .filter(({ entry }) => entry.data.language === language)
    .map((one) => ({ twin: seriesTwinPathOf(one), parts: one.parts.length, ...seriesMetadataOf(one) }));
  const list = articles.map(({ title, twin, published, summary }) => `- [${title}](${absolute(twin)}) (${published}): ${summary}`);
  const seriesList = series.map(
    ({ title, twin, status, parts, summary }) => `- [${title}](${absolute(twin)}) (${status}, ${ui.parts(parts)}): ${summary}`,
  );
  return markdownResponse(
    {
      title: index.title,
      summary: index.summary,
      published: articles.at(-1)?.published,
      updated: articles.map((a) => a.updated).sort().at(-1),
      language,
      tags: [],
      canonical: index.canonical,
    },
    [
      `# ${index.title}`,
      index.summary,
      list.join('\n'),
      seriesList.length > 0 && `## ${ui.series}\n\n${seriesList.join('\n')}`,
    ],
  );
};
