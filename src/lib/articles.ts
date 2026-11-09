import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE_URL } from '../../site.config.mjs';
import { lastUpdatedOf } from './git';
import { describeFolderFile } from './own-folder';

export type Article = CollectionEntry<'articles'>;

/** The Writing index: the section listing every Article. */
export const WRITING = {
  title: 'Writing',
  summary: 'Articles: arguments, essays and reflections on engineering beyond implementation.',
  path: '/writing/',
  twin: '/writing.md',
  canonical: new URL('/writing/', SITE_URL).href,
};

const day = (date: Date) => date.toISOString().slice(0, 10);

export const pathOf = (article: Article) => `/writing/${article.id}/`;
export const twinPathOf = (article: Article) => `/writing/${article.id}.md`;
export const canonicalOf = (article: Article) => new URL(pathOf(article), SITE_URL).href;

/** Every Article, newest first. */
export async function getArticles(): Promise<Article[]> {
  const articles = await getCollection('articles');
  for (const article of articles) attachmentsOf(article);
  return articles.sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.id.localeCompare(b.id));
}

/** The metadata shared by the page, its JSON-LD, its Markdown twin and the feed. */
export function metadataOf(article: Article) {
  const { title, summary, published, language, tags, featured } = article.data;
  return {
    title,
    summary,
    published: day(published),
    updated: lastUpdatedOf(article.filePath!, day(published)),
    language,
    tags,
    featured,
    canonical: canonicalOf(article),
  };
}

export interface Attachment {
  title: string;
  file: string;
  /** Where the file is served: beside the Article, at `/writing/<slug>/<file>`. */
  path: string;
  /** "materials.csv, CSV, 32 bytes". */
  description: string;
}

/** The Article's attachments, from its own folder; a missing file fails the build. */
export function attachmentsOf(article: Article): Attachment[] {
  return article.data.attachments.map(({ title, file }) => ({
    title,
    file,
    path: `${pathOf(article)}${file}`,
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
