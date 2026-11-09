import type { APIRoute, GetStaticPaths } from 'astro';
import { SITE_URL } from '../../../site.config.mjs';
import { attachmentsOf, correctionsOf, discussOf, getArticles, metadataOf, type Article } from '../../lib/articles';
import { getSeries, positionOf, type Position } from '../../lib/series';

export const getStaticPaths = (async () => {
  const [articles, series] = await Promise.all([getArticles(), getSeries()]);
  return articles.map((article) => ({
    params: { slug: article.id },
    props: { article, position: positionOf(article, series) },
  }));
}) satisfies GetStaticPaths;

const yamlString = (value: string) => JSON.stringify(value);
const absolute = (path: string) => new URL(path, SITE_URL).href;

/**
 * The Article's Markdown twin: its front-matter, its body, then its end matter as on the
 * page. A part of a Series states its position under the title and links its neighbours.
 */
export const GET: APIRoute<{ article: Article; position?: Position }> = ({ props: { article, position } }) => {
  const meta = metadataOf(article);
  const discuss = discussOf(article);
  const attachments = attachmentsOf(article);
  const corrections = correctionsOf(article);
  const frontMatter = [
    '---',
    `title: ${yamlString(meta.title)}`,
    `summary: ${yamlString(meta.summary)}`,
    `published: ${meta.published}`,
    `updated: ${meta.updated}`,
    `language: ${meta.language}`,
    `tags: [${meta.tags.map(yamlString).join(', ')}]`,
    `canonical: ${meta.canonical}`,
    `featured: ${meta.featured}`,
    ...(discuss.length > 0 ? ['discuss:', ...discuss.map(({ network, href }) => `  ${network.toLowerCase()}: ${href}`)] : []),
    ...(position
      ? [
          'series:',
          `  title: ${yamlString(position.series.title)}`,
          `  canonical: ${position.series.canonical}`,
          `  part: ${position.part}`,
          `  of: ${position.of}`,
        ]
      : []),
    '---',
  ];
  const sections = [
    `# ${meta.title}`,
    ...(position ? [`Part ${position.part} of ${position.of} · [${position.series.title}](${absolute(position.series.twin)})`] : []),
    (article.body ?? '').trim(),
    ...(position && (position.previous || position.next)
      ? [
          `## Series: ${position.series.title}`,
          [
            ...(position.previous ? [`- Previous: [${position.previous.title}](${absolute(position.previous.twin)})`] : []),
            ...(position.next ? [`- Next: [${position.next.title}](${absolute(position.next.twin)})`] : []),
          ].join('\n'),
        ]
      : []),
    ...(attachments.length > 0
      ? [
          '## Attachments',
          attachments
            .map(({ title, path, description }) => `- [${title}](${absolute(path)}) (${description})`)
            .join('\n'),
        ]
      : []),
    ...(corrections.length > 0
      ? ['## Corrections', corrections.map(({ date, note }) => `- ${date}: ${note}`).join('\n')]
      : []),
  ];
  return new Response(`${frontMatter.join('\n')}\n\n${sections.join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
