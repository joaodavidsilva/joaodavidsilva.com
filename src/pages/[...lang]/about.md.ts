import type { APIRoute } from 'astro';
import { ABOUT_PATH, aboutMarkdown, type Record } from '../../lib/record';
import { aboutRoutes } from '../../lib/routes';
import { alternateAt, translationFields, type Translations } from '../../lib/translations';
import { markdownResponse } from '../../lib/twin';
import { uiOf } from '../../lib/ui';

export const getStaticPaths = aboutRoutes;

export const GET: APIRoute = ({ props }) => {
  const { record, translations } = props as { record: Record; translations: Translations };
  const title = uiOf(record.language).about;
  return markdownResponse(
    {
      title,
      summary: `${record.name}. ${record.headline}`,
      language: record.language,
      canonical: alternateAt(ABOUT_PATH, record.language).canonical,
      ...translationFields(translations),
    },
    [`# ${title}`, aboutMarkdown(record)],
  );
};
