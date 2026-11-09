import { getCollection, type CollectionEntry } from 'astro:content';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { SITE_URL } from '../../site.config.mjs';
import { lastUpdatedOf } from './git';

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

/** The Article's own folder, `articles/<slug>/`, relative to the project. */
const folderOf = (article: Article) => join(dirname(article.filePath!), article.id);

/**
 * Every file in the Article's own folder (its images and attachments), published
 * beside it at `/writing/<slug>/<file>`, so relative links in its Markdown twin resolve.
 */
export function folderFilesOf(article: Article): { file: string; source: string }[] {
  const folder = resolve(folderOf(article));
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({ file: entry.name, source: join(folder, entry.name) }));
}

/** The Article's attachments, from its own folder; a missing file fails the build. */
export function attachmentsOf(article: Article): Attachment[] {
  return article.data.attachments.map(({ title, file }) => {
    const source = resolve(folderOf(article), file);
    if (!existsSync(source)) {
      throw new Error(`${article.filePath}: attachment "${file}" not found in ${folderOf(article)}/`);
    }
    const type = extname(file).slice(1).toUpperCase() || 'file';
    return { title, file, path: `${pathOf(article)}${file}`, description: `${file}, ${type}, ${sizeOf(source)}` };
  });
}

function sizeOf(file: string): string {
  const bytes = statSync(file).size;
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Minutes an unhurried reader needs for the body, at about 230 words a minute. */
export function readingMinutesOf(article: Article): number {
  const words = (article.body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
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
