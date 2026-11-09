import type { APIRoute, GetStaticPaths } from 'astro';
import { SITE_URL } from '../../../site.config.mjs';
import * as writing from '../../lib/articles';
import { discussedInOf, getStudies, linksOf, metadataOf, type Study } from '../../lib/studies';

export const getStaticPaths = (async () => {
  const [studies, articles] = await Promise.all([getStudies(), writing.getArticles()]);
  return studies.map((study) => ({ params: { slug: study.id }, props: { study, articles } }));
}) satisfies GetStaticPaths;

const yamlString = (value: string) => JSON.stringify(value);

/** The Study's Markdown twin: its front-matter, its sections, then its end matter as on the page. */
export const GET: APIRoute<{ study: Study; articles: writing.Article[] }> = ({ props: { study, articles } }) => {
  const meta = metadataOf(study);
  const { data, scripts } = linksOf(study);
  const discussedIn = discussedInOf(study, articles);
  const frontMatter = [
    '---',
    `title: ${yamlString(meta.title)}`,
    `summary: ${yamlString(meta.summary)}`,
    `published: ${meta.published}`,
    `updated: ${meta.updated}`,
    `language: ${meta.language}`,
    `tags: [${meta.tags.map(yamlString).join(', ')}]`,
    `canonical: ${meta.canonical}`,
    `status: ${meta.status}`,
    `featured: ${meta.featured}`,
    '---',
  ];
  const links = [
    ...data.map((link) => ({ kind: 'Data', ...link })),
    ...scripts.map((link) => ({ kind: 'Script', ...link })),
  ].map(
    ({ kind, title, href, description }) =>
      `- ${kind}: [${title}](${new URL(href, SITE_URL).href})${description ? ` (${description})` : ''}`,
  );
  const sections = [
    `# ${meta.title}`,
    (study.body ?? '').trim(),
    ...(links.length > 0 ? ['## Data and scripts', links.join('\n')] : []),
    ...(discussedIn.length > 0
      ? [
          '## Discussed in',
          discussedIn
            .map((article) => {
              const { title, published } = writing.metadataOf(article);
              return `- [${title}](${new URL(writing.twinPathOf(article), SITE_URL).href}) (${published})`;
            })
            .join('\n'),
        ]
      : []),
  ];
  return new Response(`${frontMatter.join('\n')}\n\n${sections.join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
