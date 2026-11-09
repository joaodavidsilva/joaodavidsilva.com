import type { APIRoute, GetStaticPaths } from 'astro';
import { SITE_URL } from '../../../site.config.mjs';
import { attachmentsOf, correctionsOf, discussOf, getArticles, metadataOf, type Article } from '../../lib/articles';

export const getStaticPaths = (async () => {
  const articles = await getArticles();
  return articles.map((article) => ({ params: { slug: article.id }, props: { article } }));
}) satisfies GetStaticPaths;

const yamlString = (value: string) => JSON.stringify(value);

/** The Article's Markdown twin: its front-matter, its body, then its end matter as on the page. */
export const GET: APIRoute<{ article: Article }> = ({ props: { article } }) => {
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
    '---',
  ];
  const sections = [
    `# ${meta.title}`,
    (article.body ?? '').trim(),
    ...(attachments.length > 0
      ? [
          '## Attachments',
          attachments
            .map(({ title, path, description }) => `- [${title}](${new URL(path, SITE_URL).href}) (${description})`)
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
