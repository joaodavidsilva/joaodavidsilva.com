import { getCollection, type CollectionEntry } from 'astro:content';
import { day } from './metadata';
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
