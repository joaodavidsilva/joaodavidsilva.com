import type { APIRoute } from 'astro';
import { byCategory, getKnowledge, knowledgeIndexOf, markdownList } from '../../lib/knowledge';
import { languageParams } from '../../lib/sections';
import type { Language } from '../../lib/translations';
import { markdownResponse } from '../../lib/twin';

export const getStaticPaths = () => languageParams('knowledge');

export const GET: APIRoute = async ({ props }) => {
  const { language } = props as { language: Language };
  const index = knowledgeIndexOf(language);
  const groups = byCategory(await getKnowledge(language));
  return markdownResponse({ title: index.title, summary: index.summary, language, canonical: index.canonical }, [
    `# ${index.title}`,
    ...groups.map((group) => `## ${group.category}\n\n${markdownList(group.entries)}`),
  ]);
};
