import type { APIRoute } from 'astro';
import { canonicalOf, twinPathOf, type KnowledgeEntry } from '../../../lib/knowledge';
import { knowledgeRoutes } from '../../../lib/routes';
import { absolute, translationFields } from '../../../lib/translations';
import { markdownResponse } from '../../../lib/twin';
import { uiOf } from '../../../lib/ui';

export const getStaticPaths = knowledgeRoutes;

export const GET: APIRoute = ({ props }) => {
  const { entry, related, skillUrl, updated, translations } = (props as { item: KnowledgeEntry }).item;
  const { title, summary, kind, category, tags, language } = entry.data;
  const ui = uiOf(language);
  return markdownResponse(
    { title, summary, kind, category, updated, language, tags, skill: skillUrl, canonical: canonicalOf(entry), ...translationFields(translations) },
    [
      `# ${title}`,
      (entry.body ?? '').trim(),
      related.length > 0 && `## ${ui.related}\n\n${related.map((target) => `- [${target.data.title}](${absolute(twinPathOf(target))})`).join('\n')}`,
    ],
  );
};
