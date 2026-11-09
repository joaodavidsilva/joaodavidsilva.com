import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE_URL } from '../../site.config.mjs';
import type { Article } from './articles';
import { assertPublished, metadataOf as sharedMetadataOf } from './metadata';
import { describeFolderFile } from './own-folder';
import {
  alternateAt, assertTranslations, inLanguage, isTranslation, locate, originalIdOf, ORIGINAL_LANGUAGE,
  translationsOf as translationsAmong, type Language,
} from './translations';
import { uiOf } from './ui';

export type Study = CollectionEntry<'studies'>;
export type Status = Study['data']['status'];

/** Where the Study with id `id` is published, in English. */
const studyPathOf = (id: string) => `/research/${id}/`;

/** The Research index in `language`: the section listing every Study. */
export function researchIndexOf(language: Language) {
  return { ...uiOf(language).research, ...alternateAt('/research/', language) };
}

/** The sections every Study's body has, as `##` headings in this order (in its Original). */
export const STUDY_SECTIONS = ['Question', 'Hypothesis', 'Method', 'Observations', 'Findings', 'Limitations'];

export const pathOf = (study: Study) => locate(study, studyPathOf).path;
export const twinPathOf = (study: Study) => locate(study, studyPathOf).twin;
export const canonicalOf = (study: Study) => locate(study, studyPathOf).canonical;
export const translationsOf = (study: Study, studies: Study[]) => translationsAmong(study, studies, studyPathOf);

/**
 * Every Study and Translation, newest first; one published after today, an Original missing
 * a section (a Translation translates the headings) or a data file fails the build.
 */
export async function getAllStudies(): Promise<Study[]> {
  const studies = await getCollection('studies');
  assertTranslations(studies, { pathOf: studyPathOf, same: ['status', 'featured'] });
  for (const study of studies) {
    assertPublished(study);
    if (!isTranslation(study)) assertSections(study);
    linksOf(study);
  }
  return studies.sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.id.localeCompare(b.id));
}

/** Every Study in `language`, newest first. */
export async function getStudies(language: Language = ORIGINAL_LANGUAGE): Promise<Study[]> {
  return (await getAllStudies()).filter((study) => study.data.language === language);
}

/** The metadata shared by the page, its JSON-LD, its Markdown twin and the feed. */
export function metadataOf(study: Study) {
  const { title, summary, status, featured } = study.data;
  return { ...sharedMetadataOf(study, studyPathOf, { title, summary }), status, featured };
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
  /** A file in the Original's own folder, served at `/research/<slug>/<file>`, or an external URL. */
  href: string;
  /** For files: "CSV, 32 bytes". */
  description?: string;
}

/** The Study's data and scripts; a file missing from its own folder fails the build. */
export function linksOf(study: Study): { data: StudyLink[]; scripts: StudyLink[] } {
  const resolve = (kind: string) => (link: Study['data']['data'][number]): StudyLink =>
    'file' in link
      ? { title: link.title, href: `${studyPathOf(originalIdOf(study))}${link.file}`, description: describeFolderFile(study, link.file, kind) }
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

/**
 * The Articles that cite the Study by linking to it, in the order of `articles` (every Article
 * and Translation) ("Discussed in"): the Originals citing its Original, in the Study's language.
 */
export function discussedInOf(study: Study, articles: Article[]): Article[] {
  const id = originalIdOf(study);
  return articles
    .filter((article) => !isTranslation(article))
    .filter((article) => proseLinesOf(article.body ?? '').some((line) => [...line.matchAll(CITATION)].some((m) => m[1] === id)))
    .flatMap((article) => inLanguage(article, study.data.language, articles) ?? []);
}
