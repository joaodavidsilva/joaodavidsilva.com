import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE_URL } from '../../site.config.mjs';
import type { Article } from './articles';
import { lastUpdatedOf } from './git';
import { describeFolderFile } from './own-folder';

export type Study = CollectionEntry<'studies'>;
export type Status = Study['data']['status'];

/** The Research index: the section listing every Study. */
export const RESEARCH = {
  title: 'Research',
  summary: 'Studies: the record of each investigation, from question to limitations, in progress, concluded or abandoned.',
  path: '/research/',
  twin: '/research.md',
  canonical: new URL('/research/', SITE_URL).href,
};

/** The sections every Study's body has, as `##` headings in this order. */
export const STUDY_SECTIONS = ['Question', 'Hypothesis', 'Method', 'Observations', 'Findings', 'Limitations'];

export const STATUS_LABELS: Record<Status, string> = {
  'in progress': 'In progress',
  concluded: 'Concluded',
  abandoned: 'Abandoned',
};

const day = (date: Date) => date.toISOString().slice(0, 10);

export const pathOf = (study: Study) => `/research/${study.id}/`;
export const twinPathOf = (study: Study) => `/research/${study.id}.md`;
export const canonicalOf = (study: Study) => new URL(pathOf(study), SITE_URL).href;

/** Every Study, newest first; a Study missing a section or a data file fails the build. */
export async function getStudies(): Promise<Study[]> {
  const studies = await getCollection('studies');
  for (const study of studies) {
    assertSections(study);
    linksOf(study);
  }
  return studies.sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.id.localeCompare(b.id));
}

/** The metadata shared by the page, its JSON-LD, its Markdown twin and the feed. */
export function metadataOf(study: Study) {
  const { title, summary, published, status, language, tags, featured } = study.data;
  return {
    title,
    summary,
    published: day(published),
    updated: lastUpdatedOf(study.filePath!, day(published)),
    status,
    language,
    tags,
    featured,
    canonical: canonicalOf(study),
  };
}

/** The lines of a Markdown body outside fenced code blocks, with inline code removed. */
function proseLinesOf(body: string): string[] {
  const lines: string[] = [];
  let fence: string | undefined;
  for (const line of body.split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    if (marker && (!fence || (marker[0] === fence[0] && marker.length >= fence.length))) {
      fence = fence ? undefined : marker;
    } else if (!fence) {
      lines.push(line.replace(/(`+)[^`].*?\1/g, ''));
    }
  }
  return lines;
}

function assertSections(study: Study) {
  const headings = proseLinesOf(study.body ?? '')
    .map((line) => line.match(/^ {0,3}##[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/)?.[1]?.toLowerCase())
    .filter((heading) => heading !== undefined);
  const positions = STUDY_SECTIONS.map((section) => headings.indexOf(section.toLowerCase()));
  const order = `a Study's sections are ${STUDY_SECTIONS.slice(0, -1).join(', ')} and ${STUDY_SECTIONS.at(-1)}, as "##" headings in that order`;
  const missing = STUDY_SECTIONS.find((_, i) => positions[i] === -1);
  if (missing) throw new Error(`${study.filePath}: a Study needs a "## ${missing}" section (${order})`);
  const misplaced = STUDY_SECTIONS.findIndex((_, i) => i > 0 && positions[i] < positions[i - 1]);
  if (misplaced > 0) {
    throw new Error(
      `${study.filePath}: "## ${STUDY_SECTIONS[misplaced]}" must come after "## ${STUDY_SECTIONS[misplaced - 1]}" (${order})`,
    );
  }
}

export interface StudyLink {
  title: string;
  /** A file in the Study's own folder, served at `/research/<slug>/<file>`, or an external URL. */
  href: string;
  /** For files: "recall.csv, CSV, 32 bytes". */
  description?: string;
}

/** The Study's data and scripts; a file missing from its own folder fails the build. */
export function linksOf(study: Study): { data: StudyLink[]; scripts: StudyLink[] } {
  const resolve = (kind: string) => (link: Study['data']['data'][number]): StudyLink =>
    'file' in link
      ? { title: link.title, href: `${pathOf(study)}${link.file}`, description: describeFolderFile(study, link.file, kind) }
      : { title: link.title, href: link.url };
  return { data: study.data.data.map(resolve('data file')), scripts: study.data.scripts.map(resolve('script')) };
}

/**
 * A link to a Study (its page, a section of it or its twin) as the destination of a
 * Markdown inline link, a reference definition or an HTML `href`: the Study's slug.
 */
const CITATION = new RegExp(
  String.raw`(?:\]\(\s*<?|^ {0,3}\[[^\]]+\]:\s*<?|href=["'])(?:${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})?/research/([\w-]+)(?:/|\.md)`,
  'g',
);

/** The Articles that cite the Study by linking to it, in the order given ("Discussed in"). */
export function discussedInOf(study: Study, articles: Article[]): Article[] {
  return articles.filter((article) =>
    proseLinesOf(article.body ?? '').some((line) => [...line.matchAll(CITATION)].some((m) => m[1] === study.id)),
  );
}
