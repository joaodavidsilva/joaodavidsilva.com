import { getCollection, type CollectionEntry } from 'astro:content';
import { day } from './metadata';
import { inlineParagraph } from './inline-markdown';
import { assertTranslations, ORIGINAL_LANGUAGE, translationsOf as translationsAmong, type Language } from './translations';

export type Now = CollectionEntry<'now'>;

export const NOW_PATH = '/now/';
const nowPathOf = () => NOW_PATH;

/** The Now entry and its Translations; none when the content set has no Now. */
export async function getAllNow(): Promise<Now[]> {
  const entries = await getCollection('now');
  assertTranslations(entries, { pathOf: nowPathOf, same: ['date'] });
  return entries;
}

/** The Now entry in `language`, or undefined when there is none. */
export async function getNow(language: Language = ORIGINAL_LANGUAGE): Promise<Now | undefined> {
  return (await getAllNow()).find((now) => now.data.language === language);
}

export const translationsOf = (now: Now, entries: Now[]) => translationsAmong(now, entries, nowPathOf);

export const dateOf = (now: Now) => day(now.data.date);

export interface NowRow {
  label: string;
  html: string;
}

/** The Now entry's `## Label` paragraphs as semantic labelled rows, with inline links intact. */
export function rowsOf(now: Now, fallbackLabel = 'Working on'): NowRow[] {
  const rows: NowRow[] = [];
  let label: string | undefined = fallbackLabel;
  let lines: string[] = [];
  const finish = () => {
    const text = lines.join(' ').trim();
    if (label && text) rows.push({ label, html: inlineParagraph([text]) });
    lines = [];
  };
  for (const line of (now.body ?? '').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      finish();
      label = heading[1];
    } else if (line.trim()) lines.push(line.trim());
  }
  finish();
  return rows;
}
