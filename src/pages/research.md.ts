import type { APIRoute } from 'astro';
import { SITE_URL } from '../../site.config.mjs';
import { getStudies, metadataOf, RESEARCH, twinPathOf } from '../lib/studies';

/** The Research index's Markdown twin: every Study with its status, newest first. */
export const GET: APIRoute = async () => {
  const studies = (await getStudies()).map((study) => ({ twin: twinPathOf(study), ...metadataOf(study) }));
  const frontMatter = [
    '---',
    `title: ${JSON.stringify(RESEARCH.title)}`,
    `summary: ${JSON.stringify(RESEARCH.summary)}`,
    ...(studies.length > 0
      ? [`published: ${studies.at(-1)!.published}`, `updated: ${studies.map((s) => s.updated).sort().at(-1)}`]
      : []),
    'language: en',
    'tags: []',
    `canonical: ${RESEARCH.canonical}`,
    '---',
  ];
  const list = studies.map(
    ({ title, twin, published, status, summary }) =>
      `- [${title}](${new URL(twin, SITE_URL).href}) (${published}, ${status}): ${summary}`,
  );
  const body = [`# ${RESEARCH.title}`, RESEARCH.summary, ...(list.length > 0 ? [list.join('\n')] : [])];
  return new Response(`${frontMatter.join('\n')}\n\n${body.join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
