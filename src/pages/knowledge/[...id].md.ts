import type { APIRoute, GetStaticPaths } from 'astro';
import { canonicalOf, getKnowledge, pathOf, type KnowledgeEntry } from '../../lib/knowledge';

export const getStaticPaths = (async () =>
  (await getKnowledge()).map((item) => ({ params: { id: item.entry.id }, props: { item } }))) satisfies GetStaticPaths;

const yamlString = (value: string) => JSON.stringify(value);

export const GET: APIRoute = ({ props }) => {
  const { entry, related, skillUrl, updated } = (props as { item: KnowledgeEntry }).item;
  const { title, summary, kind, category, tags, language } = entry.data;
  const frontMatter = [
    '---',
    `title: ${yamlString(title)}`,
    `summary: ${yamlString(summary)}`,
    `kind: ${kind}`,
    `category: ${yamlString(category)}`,
    `updated: ${updated}`,
    `language: ${language}`,
    `tags: [${tags.map(yamlString).join(', ')}]`,
    ...(skillUrl ? [`skill: ${skillUrl}`] : []),
    `canonical: ${canonicalOf(entry)}`,
    '---',
  ].join('\n');
  const relatedList = related.length
    ? `\n\n## Related\n\n${related.map((target) => `- [${target.data.title}](${pathOf(target)})`).join('\n')}`
    : '';
  return new Response(`${frontMatter}\n\n# ${title}\n\n${(entry.body ?? '').trim()}${relatedList}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
