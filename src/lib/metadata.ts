import { lastUpdatedOf } from './git';
import { locate, type Language, type PathOf, type Translatable } from './translations';

/** A calendar day, YYYY-MM-DD (UTC). */
export const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Fails the build for an entry published after the build day: a static site has no
 * scheduler, so a future date would publish the piece early with a date still to come.
 */
export function assertPublished(entry: { filePath?: string; data: { published: Date } }) {
  const published = day(entry.data.published);
  if (published > day(new Date())) {
    throw new Error(`${entry.filePath}: published ${published} is after today; set the date or keep it out of content/`);
  }
}

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

/** A listing's dates: when its earliest item was published and when its latest was last updated. */
export const listingDatesOf = (items: { published?: string; updated?: string }[]) => ({
  published: items.map((item) => item.published).filter(Boolean).sort()[0],
  updated: items.map((item) => item.updated).filter(Boolean).sort().at(-1),
});

/** The JSON-LD of an index page listing `items`, in order. */
export const collectionJsonLd = (meta: Metadata, items: { name: string; url: string }[]) => ({
  ...jsonLdBase('CollectionPage', meta),
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, ...item })),
  },
});

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
