import type { APIRoute } from 'astro';
import { ABOUT_PATH, aboutMarkdown, type ProfessionalRecord } from '../../lib/record';
import { aboutRoutes } from '../../lib/routes';
import { alternateAt, translationFields, type Translations } from '../../lib/translations';
import { markdownResponse } from '../../lib/twin';
import { uiOf } from '../../lib/ui';

export const getStaticPaths = aboutRoutes;

export const GET: APIRoute = ({ props }) => {
  const { record, translations, updated } = props as { record: ProfessionalRecord; translations: Translations; updated?: string };
  const title = uiOf(record.language).about;
  return markdownResponse(
    {
      title,
      summary: `${record.name}. ${record.headline}`,
      updated,
      language: record.language,
      tags: [],
      canonical: alternateAt(ABOUT_PATH, record.language).canonical,
      ...translationFields(translations),
    },
    [`# ${title}`, aboutMarkdown(record)],
  );
};
