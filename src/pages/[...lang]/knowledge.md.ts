import type { APIRoute } from 'astro';
import { byCategory, getKnowledge, indexMetadataOf, markdownList } from '../../lib/knowledge';
import { languageParams } from '../../lib/sections';
import type { Language } from '../../lib/translations';
import { markdownResponse } from '../../lib/twin';

export const getStaticPaths = () => languageParams('knowledge');

export const GET: APIRoute = async ({ props }) => {
  const { language } = props as { language: Language };
  const entries = await getKnowledge(language);
  const meta = indexMetadataOf(language, entries);
  return markdownResponse(meta, [
    `# ${meta.title}`,
    ...byCategory(entries).map((group) => `## ${group.category}\n\n${markdownList(group.entries)}`),
  ]);
};
