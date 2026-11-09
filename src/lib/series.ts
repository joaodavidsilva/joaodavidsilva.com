import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE_URL } from '../../site.config.mjs';
import * as articles from './articles';
import { lastUpdatedOf } from './git';

type Article = articles.Article;
type Entry = CollectionEntry<'series'>;

/** A Series and its parts, in order: `parts[i]` is part `i + 1`. */
export interface Series {
  entry: Entry;
  parts: Article[];
}

/** An Article's place in its Series, as shown on the page, in its twin and in JSON-LD. */
export interface Position {
  series: { title: string; path: string; twin: string; canonical: string };
  part: number;
  of: number;
  previous?: Link;
  next?: Link;
}

interface Link {
  title: string;
  path: string;
  twin: string;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/** How a Series' status reads on its page and in its twin. */
export const STATUS_LABELS = { ongoing: 'Ongoing', complete: 'Complete' } as const;

export const pathOf = (series: Series) => `/writing/series/${series.entry.id}/`;
export const twinPathOf = (series: Series) => `/writing/series/${series.entry.id}.md`;
export const canonicalOf = (series: Series) => new URL(pathOf(series), SITE_URL).href;

/**
 * Every Series, newest first, with its parts in order. The build fails when two
 * Articles claim the same part of a Series or when a part is missing, so
 * "Part N of M" always counts parts 1 to M.
 */
export async function getSeries(): Promise<Series[]> {
  const [entries, allArticles] = await Promise.all([getCollection('series'), articles.getArticles()]);
  const byId = new Map(entries.map((entry) => [entry.id, { entry, parts: [] as Article[] }]));
  for (const article of allArticles) {
    const { series } = article.data;
    if (!series) continue;
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
  return [...byId.values()].sort(
    (a, b) => b.entry.data.published.getTime() - a.entry.data.published.getTime() || a.entry.id.localeCompare(b.entry.id),
  );
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
  article && { title: article.data.title, path: articles.pathOf(article), twin: articles.twinPathOf(article) };

/** Where `article` sits in its Series, if it is a part of one. */
export function positionOf(article: Article, allSeries: Series[]): Position | undefined {
  const series = allSeries.find(({ entry }) => entry.id === article.data.series?.id);
  if (!series) return undefined;
  const i = series.parts.findIndex(({ id }) => id === article.id);
  return {
    series: {
      title: series.entry.data.title,
      path: pathOf(series),
      twin: twinPathOf(series),
      canonical: canonicalOf(series),
    },
    part: i + 1,
    of: series.parts.length,
    previous: linkOf(series.parts[i - 1]),
    next: linkOf(series.parts[i + 1]),
  };
}
