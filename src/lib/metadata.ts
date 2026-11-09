import { lastUpdatedOf } from './git';
import { locate, type Language, type PathOf, type Translatable } from './translations';

/** A calendar day, YYYY-MM-DD (UTC). */
export const day = (date: Date) => date.toISOString().slice(0, 10);

/** The metadata every page shares between its HTML, its JSON-LD and its Markdown twin. */
export interface Metadata {
  title: string;
  summary: string;
  /** YYYY-MM-DD */
  published?: string;
  /** YYYY-MM-DD, from git history. */
  updated?: string;
  language: Language;
  tags?: string[];
  canonical: string;
}

/** A published entry: its source file, its publication day and its tags. */
interface Entry extends Translatable {
  data: Translatable['data'] & { published: Date; tags: string[] };
}

/** The shared metadata of an entry of a collection publishing Originals at `pathOf`; `updated` comes from git. */
export function metadataOf(entry: Entry, pathOf: PathOf, text: { title: string; summary: string }) {
  const published = day(entry.data.published);
  return {
    ...text,
    published,
    updated: lastUpdatedOf(entry.filePath!, published),
    language: entry.data.language,
    tags: entry.data.tags,
    canonical: locate(entry, pathOf).canonical,
  };
}

/** The JSON-LD every page starts from: a `type` with the page's shared metadata. */
export const jsonLdBase = (type: string, meta: Metadata) => ({
  '@context': 'https://schema.org',
  '@type': type,
  name: meta.title,
  headline: meta.title,
  description: meta.summary,
  datePublished: meta.published,
  dateModified: meta.updated,
  inLanguage: meta.language,
  keywords: meta.tags,
  url: meta.canonical,
});
