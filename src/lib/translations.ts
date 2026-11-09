import { resolve } from 'node:path';
import { z } from 'astro/zod';
import { LANGUAGES, SITE_URL } from '../../site.config.mjs';
import { originalHash } from './original-hash.mjs';

export type Language = keyof typeof LANGUAGES;

/** The language of every Original; Translations live under `/<language>/` (ADR-0005). */
export const ORIGINAL_LANGUAGE = 'en';

/** Portuguese is reviewed by João; every other Translation is an AI translation. */
const REVIEWED_LANGUAGE = 'pt';

const LANGUAGE_CODES = Object.keys(LANGUAGES) as Language[];
const TRANSLATION_LANGUAGES = LANGUAGE_CODES.filter((code) => code !== ORIGINAL_LANGUAGE);

/**
 * Front-matter every translatable collection carries (ADR-0005). A Translation is a file at
 * its Original's path under `<language>/` in the same collection, and records
 * `translatedFrom`, the hash of the Original's revision it was made from
 * (`pnpm translation:hash <original>`), quoted.
 */
export const translatable = {
  language: z.enum(LANGUAGE_CODES as [Language, ...Language[]]).default(ORIGINAL_LANGUAGE),
  translatedFrom: z.string().regex(/^[0-9a-f]{12}$/).optional(),
};

/** A glob loader pattern for `file` (such as `*.md`) and its Translations under `<language>/`. */
export const withTranslations = (file: string) => `{${file},{${TRANSLATION_LANGUAGES.join(',')}}/${file}}`;

/** An entry of a translatable collection. */
export interface Translatable {
  id: string;
  filePath?: string;
  data: { language: Language; translatedFrom?: string; legal?: unknown };
}

/** Where a collection publishes the Original with `id`: its English path, such as `/writing/<id>/`. */
export type PathOf = (id: string) => string;

/** One language a page exists in, as hreflang and the language switcher link it. */
export interface Alternate {
  language: Language;
  /** The language's own name, as the switcher shows it. */
  name: string;
  path: string;
  twin: string;
  canonical: string;
}

/** A page's place among its Original and Translations. */
export interface Translations {
  /** Every language the page exists in: the Original first, then by language code. */
  alternates: Alternate[];
  /** The page's Original, when the page is a Translation. */
  original?: Alternate;
  /** An AI translation, labelled "Translated by AI". */
  ai: boolean;
  /** An Outdated translation: made from an earlier revision of its Original. */
  outdated: boolean;
}

/** `path` (an English path) in `language`. */
export const pathIn = (path: string, language: Language) =>
  language === ORIGINAL_LANGUAGE ? path : `/${language}${path}`;

/** The `[...lang]` route parameter of `language`: none for the original language. */
export const langParam = (language: Language) => (language === ORIGINAL_LANGUAGE ? undefined : language);

/** The Markdown twin of the page at `path`: `/a/b/` is `/a/b.md`, a language root `/pt/` is `/pt/index.md`. */
export function twinOf(path: string): string {
  const language = languageOfPath(path);
  const english = language === ORIGINAL_LANGUAGE ? path : path.slice(language.length + 1);
  return pathIn(english === '/' ? '/index.md' : `${english.slice(0, -1)}.md`, language);
}

export const absolute = (path: string) => new URL(path, SITE_URL).href;

/** The language a URL path is in, by its prefix. */
export function languageOfPath(path: string): Language {
  const first = path.split('/')[1] as Language;
  return TRANSLATION_LANGUAGES.includes(first) ? first : ORIGINAL_LANGUAGE;
}

export const isTranslation = (entry: Translatable) => entry.data.language !== ORIGINAL_LANGUAGE;

/**
 * The id of the Original an entry translates; an Original's own id. The glob loader drops a
 * trailing `index`, so the Translation of `index` is `pt`.
 */
export function originalIdOf(entry: Translatable): string {
  const { language } = entry.data;
  if (!isTranslation(entry)) return entry.id;
  return entry.id === language ? 'index' : entry.id.slice(language.length + 1);
}

/** The page at English path `path` in `language`. */
export function alternateAt(path: string, language: Language): Alternate {
  const localised = pathIn(path, language);
  return { language, name: LANGUAGES[language], path: localised, twin: twinOf(localised), canonical: absolute(localised) };
}

/** Where an entry is published: its Original's path, under its language's prefix. */
export const locate = (entry: Translatable, pathOf: PathOf) => alternateAt(pathOf(originalIdOf(entry)), entry.data.language);

const byLanguage = (a: Translatable, b: Translatable) =>
  Number(isTranslation(a)) - Number(isTranslation(b)) || a.data.language.localeCompare(b.data.language);

const families = new WeakMap<readonly Translatable[], Map<string, Translatable[]>>();

/** Every entry of `entries` with the same Original as `entry`: the Original first, then by language. */
function familyOf<T extends Translatable>(entry: T, entries: readonly T[]): T[] {
  let index = families.get(entries);
  if (!index) {
    index = new Map();
    for (const one of entries) {
      const id = originalIdOf(one);
      index.set(id, [...(index.get(id) ?? []), one].sort(byLanguage));
    }
    families.set(entries, index);
  }
  return (index.get(originalIdOf(entry)) ?? []) as T[];
}

/** `entry` in `language`, if that Translation (or Original) exists among `entries`. */
export const inLanguage = <T extends Translatable>(entry: T, language: Language, entries: readonly T[]): T | undefined =>
  familyOf(entry, entries).find((one) => one.data.language === language);

/** The Original of `entry`. */
export const originalOf = <T extends Translatable>(entry: T, entries: readonly T[]): T => familyOf(entry, entries)[0];

/** Every language some entry is in, the original language first. */
export const languagesOf = (entries: readonly Translatable[]): Language[] =>
  LANGUAGE_CODES.filter((code) => code === ORIGINAL_LANGUAGE || entries.some((entry) => entry.data.language === code));

const hashOf = (original: Translatable) => originalHash(resolve(original.filePath!));

/** `entry`'s Translations among `entries` of a collection publishing Originals at `pathOf`. */
export function translationsOf<T extends Translatable>(entry: T, entries: readonly T[], pathOf: PathOf): Translations {
  const family = familyOf(entry, entries);
  const alternates = family.map((one) => locate(one, pathOf));
  if (!isTranslation(entry)) return { alternates, ai: false, outdated: false };
  return {
    alternates,
    original: alternates[0],
    ai: entry.data.language !== REVIEWED_LANGUAGE,
    outdated: entry.data.translatedFrom !== hashOf(family[0]),
  };
}

/** The Translations of a generated page (an index) at English path `path` that exists in `languages`. */
export const generatedTranslations = (path: string, languages: Language[]): Translations => ({
  alternates: languages.map((language) => alternateAt(path, language)),
  ai: false,
  outdated: false,
});

const display = (value: unknown) => JSON.stringify(value) ?? 'nothing';

/**
 * Fails the build on a Translation that has no Original, sits outside its language prefix,
 * does not record the revision it was translated from, translates an outdated revision of a
 * legal document, or disagrees with its Original on a field in `same` (what the page is,
 * rather than what it says); and on an Original under a language prefix.
 */
export function assertTranslations<T extends Translatable>(
  entries: readonly T[],
  { pathOf, same = [] }: { pathOf: PathOf; same?: (keyof T['data'] & string)[] },
): void {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    const { language, translatedFrom } = entry.data;
    const first = entry.id.split('/')[0];
    if (!isTranslation(entry)) {
      if (first !== ORIGINAL_LANGUAGE && first in LANGUAGES) {
        throw new Error(`${entry.filePath}: "/${first}/" holds ${LANGUAGES[first as Language]} Translations; set language: ${first} or move the file`);
      }
      continue;
    }
    if (first !== language) {
      throw new Error(`${entry.filePath}: a ${LANGUAGES[language]} Translation must live under "${language}/"`);
    }
    const originalId = originalIdOf(entry);
    const original = byId.get(originalId);
    if (!original || isTranslation(original)) {
      throw new Error(`${entry.filePath}: Translation of a missing Original "${pathOf(originalId)}"`);
    }
    const hash = hashOf(original);
    if (!translatedFrom) {
      throw new Error(`${entry.filePath}: a Translation must record translatedFrom, the hash of the Original revision it was made from (now translatedFrom: "${hash}")`);
    }
    if (original.data.legal === true && translatedFrom !== hash) {
      throw new Error(
        `${entry.filePath}: outdated Translation of a legal document; ${original.filePath} has changed since it was translated ` +
          `(translatedFrom ${translatedFrom}, now ${hash}). Update the Translation and set translatedFrom: "${hash}"`,
      );
    }
    for (const field of same) {
      const [kept, found] = [original.data, entry.data].map((data) => display((data as Record<string, unknown>)[field]));
      if (kept !== found) {
        throw new Error(`${entry.filePath}: a Translation keeps its Original's ${field} (${kept}), not ${found}`);
      }
    }
  }
}

/** The twin front-matter lines relating a Translation to its Original. */
export const translationFields = ({ original, outdated }: Translations) =>
  original ? { original: original.canonical, outdated } : {};

/** JSON-LD relating a page to its Original or its Translations, as `type`s. */
export function translationJsonLd({ original, alternates }: Translations, type: string) {
  if (original) return { translationOfWork: { '@type': type, url: original.canonical } };
  if (alternates.length > 1) {
    return { workTranslation: alternates.slice(1).map((one) => ({ '@type': type, url: one.canonical, inLanguage: one.language })) };
  }
  return {};
}

/** The `llms.txt` pointer from an Original to its Translations' twins; empty without Translations. */
export function translationPointer({ alternates }: Translations): string {
  const translations = alternates.slice(1);
  return translations.length ? ` (Translations: ${translations.map((one) => `[${one.name}](${absolute(one.twin)})`).join(', ')})` : '';
}
