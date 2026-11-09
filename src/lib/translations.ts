import { resolve } from 'node:path';
import { LANGUAGES } from '../../site.config.mjs';
import { originalHash } from './original-hash.mjs';
import { canonicalOf, pathOf, twinPathOf, type Page } from './pages';

/** The language of every Original; Translations live under `/<language>/` (ADR-0005). */
export const ORIGINAL_LANGUAGE = 'en';

/** Portuguese is reviewed by João; every other Translation is an AI translation. */
const REVIEWED_LANGUAGE = 'pt';

/** One language a page exists in. */
export interface Version {
  language: string;
  /** The language's own name, as the switcher shows it. */
  name: string;
  path: string;
  twin: string;
  canonical: string;
}

/** A page's place among its Original and Translations. */
export interface Translations {
  /** Every language the page exists in: the Original first, then by language code. */
  versions: Version[];
  /** The page's Original, when the page is a Translation. */
  original?: Version;
  /** An AI translation, labelled "Translated by AI". */
  ai: boolean;
  /** An Outdated translation: made from an earlier revision of its Original. */
  outdated: boolean;
}

const isTranslation = (page: Page) => page.data.language !== ORIGINAL_LANGUAGE;

/** The id of the Original at a page's path; an Original's own id. */
function originalIdOf(page: Page): string {
  return isTranslation(page) ? page.id.slice(page.data.language.length + 1) : page.id;
}

const hashOf = (original: Page) => originalHash(resolve(original.filePath!));

function versionOf(page: Page): Version {
  const { language } = page.data;
  return {
    language,
    name: LANGUAGES[language],
    path: pathOf(page),
    twin: twinPathOf(page),
    canonical: canonicalOf(page),
  };
}

export function translationsOf(page: Page, pages: Page[]): Translations {
  const originalId = originalIdOf(page);
  const family = pages
    .filter((other) => originalIdOf(other) === originalId)
    .sort((a, b) => Number(isTranslation(a)) - Number(isTranslation(b)) || a.data.language.localeCompare(b.data.language));
  if (!isTranslation(page)) return { versions: family.map(versionOf), ai: false, outdated: false };
  const original = family[0];
  return {
    versions: family.map(versionOf),
    original: versionOf(original),
    ai: page.data.language !== REVIEWED_LANGUAGE,
    outdated: page.data.translatedFrom !== hashOf(original),
  };
}

/**
 * Fails the build on a Translation that has no Original, sits outside its language prefix,
 * does not record the revision it was translated from, or translates an outdated revision
 * of a legal document; and on an Original under a language prefix.
 */
export function assertTranslations(pages: Page[]): void {
  const byId = new Map(pages.map((page) => [page.id, page]));
  for (const page of pages) {
    const { language, translatedFrom } = page.data;
    const first = page.id.split('/')[0];
    if (!isTranslation(page)) {
      if (first !== ORIGINAL_LANGUAGE && first in LANGUAGES) {
        throw new Error(`${page.filePath}: "/${first}/" holds ${LANGUAGES[first as keyof typeof LANGUAGES]} Translations; set language: ${first} or move the page`);
      }
      continue;
    }
    if (!page.id.startsWith(`${language}/`)) {
      throw new Error(`${page.filePath}: a ${LANGUAGES[language]} Translation must live under "/${language}/"`);
    }
    const originalId = originalIdOf(page);
    const original = byId.get(originalId);
    if (!original || isTranslation(original)) {
      const path = originalId === 'index' ? '/' : `/${originalId.replace(/\/index$/, '')}/`;
      throw new Error(`${page.filePath}: Translation of a missing Original "${path}"`);
    }
    const hash = hashOf(original);
    if (!translatedFrom) {
      throw new Error(`${page.filePath}: a Translation must record translatedFrom, the hash of the Original revision it was made from (now translatedFrom: "${hash}")`);
    }
    if (original.data.legal && translatedFrom !== hash) {
      throw new Error(
        `${page.filePath}: outdated Translation of a legal document; ${original.filePath} has changed since it was translated ` +
          `(translatedFrom ${translatedFrom}, now ${hash}). Update the Translation and set translatedFrom: "${hash}"`,
      );
    }
  }
}
