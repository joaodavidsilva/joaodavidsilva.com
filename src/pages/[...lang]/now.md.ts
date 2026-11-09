import type { APIRoute } from 'astro';
import { dateOf, NOW_PATH, type Now } from '../../lib/now';
import { nowRoutes } from '../../lib/routes';
import { alternateAt, translationFields, type Translations } from '../../lib/translations';
import { markdownResponse } from '../../lib/twin';
import { uiOf } from '../../lib/ui';

export const getStaticPaths = nowRoutes;

export const GET: APIRoute = ({ props }) => {
  const { now, translations } = props as { now: Now; translations: Translations };
  const { language } = now.data;
  const ui = uiOf(language);
  const page = { ...ui.now, ...alternateAt(NOW_PATH, language) };
  return markdownResponse(
    {
      title: page.title,
      summary: page.summary,
      // A Now entry is rewritten, not revised: its date is when it was both published and last updated.
      published: dateOf(now),
      updated: dateOf(now),
      language,
      tags: [],
      canonical: page.canonical,
      ...translationFields(translations),
    },
    [`# ${page.title}`, `${ui.updated} ${dateOf(now)}.`, (now.body ?? '').trim()],
  );
};
