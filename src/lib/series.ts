import { getCollection, type CollectionEntry } from 'astro:content';
import * as articles from './articles';
import { lastUpdatedOf } from './git';
import { day } from './metadata';
import {
  assertTranslations, inLanguage, isTranslation, languagesOf, locate, originalIdOf, ORIGINAL_LANGUAGE,
  translationsOf as translationsAmong, type Language, type Translations,
} from './translations';

type Article = articles.Article;
type Entry = CollectionEntry<'series'>;

/**
 * A Series in one language and its parts, in order: `parts[i]` is part `i + 1`, in the
 * Series' language where that Translation exists and its English Original otherwise.
 */
export interface Series {
  entry: Entry;
  parts: Article[];
  translations: Translations;
}

/** An Article's place in its Series, as shown on the page, in its twin and in JSON-LD. */
export interface Position {
  series: Link & { canonical: string };
  part: number;
  of: number;
  previous?: Link;
  next?: Link;
}

/** A link to a Series or a part, in the reader's language or, without that Translation, in English. */
export interface Link {
  title: string;
  path: string;
  twin: string;
  language: Language;
}

/** Where the Series with id `id` is published, in English. */
const seriesPathOf = (id: string) => `/writing/series/${id}/`;

export const pathOf = (series: Series) => locate(series.entry, seriesPathOf).path;
export const twinPathOf = (series: Series) => locate(series.entry, seriesPathOf).twin;
export const canonicalOf = (series: Series) => locate(series.entry, seriesPathOf).canonical;

/**
 * Every Series in `language`, newest first, with its parts in order; a Series without a
 * Translation in `language` stands in as its English Original. The build fails when two
 * Articles claim the same part of a Series or when a part is missing, so "Part N of M"
 * always counts parts 1 to M.
 */
export async function getSeries(language: Language = ORIGINAL_LANGUAGE): Promise<Series[]> {
  const [entries, allArticles] = await Promise.all([getCollection('series'), articles.getAllArticles()]);
  assertTranslations(entries, { pathOf: seriesPathOf, same: ['status'] });
  const byId = new Map(entries.filter((entry) => !isTranslation(entry)).map((entry) => [entry.id, { entry, parts: [] as Article[] }]));
  for (const article of allArticles) {
    const { series } = article.data;
    if (!series || isTranslation(article)) continue;
    const owner = byId.get(series.id);
    if (!owner) throw new Error(`${article.filePath}: Series "${series.id}" does not exist`);
    owner.parts.push(article);
  }
  for (const { entry, parts } of byId.values()) {
    parts.sort((a, b) => a.data.part! - b.data.part! || a.id.localeCompare(b.id));
    parts.forEach((article, i) => {
      const previous = parts[i - 1];
      if (previous?.data.part === article.data.part) {
        throw new Error(`Series "${entry.id}": part ${article.data.part} is claimed by both "${previous.id}" and "${article.id}"`);
      }
    });
    const gap = parts.findIndex((article, i) => article.data.part !== i + 1);
    if (gap !== -1) throw new Error(`Series "${entry.id}": part ${gap + 1} is missing`);
  }
  return [...byId.values()]
    .sort((a, b) => b.entry.data.published.getTime() - a.entry.data.published.getTime() || a.entry.id.localeCompare(b.entry.id))
    .map(({ entry, parts }) => {
      const version = inLanguage(entry, language, entries) ?? entry;
      return {
        entry: version,
        parts: parts.map((part) => inLanguage(part, language, allArticles) ?? part),
        translations: translationsAmong(version, entries, seriesPathOf),
      };
    });
}

/** Every Series and Translation, each with its parts in its language. */
export async function getAllSeries(): Promise<Series[]> {
  const languages = languagesOf(await getCollection('series'));
  const all = await Promise.all(languages.map(getSeries));
  return all.flatMap((series, i) => series.filter(({ entry }) => entry.data.language === languages[i]));
}

/** The metadata shared by the Series page, its JSON-LD and its Markdown twin. */
export function metadataOf(series: Series) {
  const { title, summary, published, language, status } = series.entry.data;
  const updates = [
    lastUpdatedOf(series.entry.filePath!, day(published)),
    ...series.parts.map((part) => articles.metadataOf(part).updated),
  ];
  return {
    title,
    summary,
    published: day(published),
    // Adding or changing a part changes the Series page too.
    updated: updates.sort().at(-1)!,
    language,
    status,
    canonical: canonicalOf(series),
  };
}

/** The parts of a Series, in order, with what their listing shows. */
export const partsOf = (series: Series) =>
  series.parts.map((article, i) => ({
    part: i + 1,
    path: articles.pathOf(article),
    twin: articles.twinPathOf(article),
    ...articles.metadataOf(article),
  }));

const linkOf = (article: Article | undefined): Link | undefined =>
  article && {
    title: article.data.title,
    path: articles.pathOf(article),
    twin: articles.twinPathOf(article),
    language: article.data.language,
  };

/** Where `article` sits in its Series, if it is a part of one; `allSeries` are the Series in the Article's language. */
export function positionOf(article: Article, allSeries: Series[]): Position | undefined {
  const series = allSeries.find(({ entry }) => originalIdOf(entry) === article.data.series?.id);
  if (!series) return undefined;
  const i = series.parts.findIndex((part) => originalIdOf(part) === originalIdOf(article));
  return {
    series: {
      title: series.entry.data.title,
      path: pathOf(series),
      twin: twinPathOf(series),
      canonical: canonicalOf(series),
      language: series.entry.data.language,
    },
    part: i + 1,
    of: series.parts.length,
    previous: linkOf(series.parts[i - 1]),
    next: linkOf(series.parts[i + 1]),
  };
}
