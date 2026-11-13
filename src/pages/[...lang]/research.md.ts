import type { APIRoute } from 'astro';
import { languageParams } from '../../lib/sections';
import { getStudies, metadataOf, researchIndexOf, twinPathOf } from '../../lib/studies';
import { absolute, type Language } from '../../lib/translations';
import { markdownResponse } from '../../lib/twin';
import { uiOf } from '../../lib/ui';

export const getStaticPaths = () => languageParams('feed');

/** The Research index's Markdown twin: every Study in its language with its status, newest first. */
export const GET: APIRoute = async ({ props }) => {
  const { language } = props as { language: Language };
  const index = researchIndexOf(language);
  const studies = (await getStudies(language)).map((study) => ({ twin: twinPathOf(study), ...metadataOf(study) }));
  return markdownResponse(
    {
      title: index.title,
      summary: index.summary,
      published: studies.at(-1)?.published,
      updated: studies.map((s) => s.updated).sort().at(-1),
      language,
      tags: [],
      canonical: index.canonical,
    },
    [
      `# ${index.title}`,
      index.summary,
      studies.length > 0
        ? studies.map(({ title, twin, published, status, summary }) => `- [${title}](${absolute(twin)}) (${published}, ${status}): ${summary}`).join('\n')
        : uiOf(language).noStudies,
    ],
  );
};
