import type { APIRoute } from 'astro';
import { markdownList, tagMetadataOf, type KnowledgeEntry } from '../../../../lib/knowledge';
import { tagRoutes } from '../../../../lib/routes';
import type { Language } from '../../../../lib/translations';
import { markdownResponse } from '../../../../lib/twin';
import { uiOf } from '../../../../lib/ui';

export const getStaticPaths = tagRoutes;

export const GET: APIRoute = ({ props }) => {
  const { tag, language, entries } = props as { tag: string; language: Language; entries: KnowledgeEntry[] };
  return markdownResponse(tagMetadataOf(tag, language, entries), [`# ${uiOf(language).tagged(tag)}`, markdownList(entries)]);
};
