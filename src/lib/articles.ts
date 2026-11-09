import { getCollection, type CollectionEntry } from 'astro:content';
import { assertPublished, day, metadataOf as sharedMetadataOf } from './metadata';
import { describeFolderFile } from './own-folder';
import {
  alternateAt, assertTranslations, locate, originalIdOf, ORIGINAL_LANGUAGE, translationsOf as translationsAmong,
  type Language,
} from './translations';
import { uiOf } from './ui';

export type Article = CollectionEntry<'articles'>;

/** Where the Article with id `id` is published, in English. */
const articlePathOf = (id: string) => `/writing/${id}/`;

/** The Writing index in `language`: the section listing every Article. */
export function writingIndexOf(language: Language) {
  return { ...uiOf(language).writing, ...alternateAt('/writing/', language) };
}

export const pathOf = (article: Article) => locate(article, articlePathOf).path;
export const twinPathOf = (article: Article) => locate(article, articlePathOf).twin;
export const canonicalOf = (article: Article) => locate(article, articlePathOf).canonical;
export const translationsOf = (article: Article, articles: Article[]) => translationsAmong(article, articles, articlePathOf);

/** Every Article and Translation, newest first; one published after today fails the build. */
export async function getAllArticles(): Promise<Article[]> {
  const articles = await getCollection('articles');
  assertTranslations(articles, { pathOf: articlePathOf, same: ['featured', 'series', 'part'] });
  for (const article of articles) {
    assertPublished(article);
    attachmentsOf(article);
  }
  return articles.sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.id.localeCompare(b.id));
}

/** Every Article in `language`, newest first. */
export async function getArticles(language: Language = ORIGINAL_LANGUAGE): Promise<Article[]> {
  return (await getAllArticles()).filter((article) => article.data.language === language);
}

/** The metadata shared by the page, its JSON-LD, its Markdown twin and the feed. */
export function metadataOf(article: Article) {
  const { title, summary, featured } = article.data;
  return { ...sharedMetadataOf(article, articlePathOf, { title, summary }), featured };
}

export interface Attachment {
  title: string;
  file: string;
  /** Where the file is served: beside the Original, at `/writing/<slug>/<file>`. */
  path: string;
  /** "materials.csv, CSV, 32 bytes". */
  description: string;
}

/** The Article's attachments, from its Original's own folder; a missing file fails the build. */
export function attachmentsOf(article: Article): Attachment[] {
  return article.data.attachments.map(({ title, file }) => ({
    title,
    file,
    path: `${articlePathOf(originalIdOf(article))}${file}`,
    description: describeFolderFile(article, file, 'attachment'),
  }));
}

/** The Discuss links that are set, in display order. */
export function discussOf(article: Article): { network: string; href: string }[] {
  const { linkedin, x } = article.data.discuss;
  return [
    ...(linkedin ? [{ network: 'LinkedIn', href: linkedin }] : []),
    ...(x ? [{ network: 'X', href: x }] : []),
  ];
}

export const correctionsOf = (article: Article) =>
  article.data.corrections.map(({ date, note }) => ({ date: day(date), note }));
