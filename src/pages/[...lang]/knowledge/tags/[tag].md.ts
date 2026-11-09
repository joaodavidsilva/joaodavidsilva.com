import type { APIRoute } from 'astro';
import { markdownList, tagPathOf, type KnowledgeEntry } from '../../../../lib/knowledge';
import { tagRoutes } from '../../../../lib/routes';
import { absolute, type Language } from '../../../../lib/translations';
import { markdownResponse } from '../../../../lib/twin';
import { uiOf } from '../../../../lib/ui';

export const getStaticPaths = tagRoutes;

export const GET: APIRoute = ({ props }) => {
  const { tag, language, entries } = props as { tag: string; language: Language; entries: KnowledgeEntry[] };
  const ui = uiOf(language);
  return markdownResponse({ title: `${ui.knowledge.title}: ${tag}`, language, canonical: absolute(tagPathOf(tag, language)) }, [
    `# ${ui.tagged(tag)}`,
    markdownList(entries),
  ]);
};
