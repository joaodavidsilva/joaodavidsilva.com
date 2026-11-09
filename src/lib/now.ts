import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE_URL } from '../../site.config.mjs';

export type Now = CollectionEntry<'now'>;

export const NOW = {
  title: 'Now',
  summary: 'What João David Silva is working on now, and when he last said so.',
  path: '/now/',
  twin: '/now.md',
  canonical: new URL('/now/', SITE_URL).href,
};

/** The Now entry, or undefined when the content set has none. */
export async function getNow(): Promise<Now | undefined> {
  return (await getCollection('now'))[0];
}

export const dateOf = (now: Now) => now.data.date.toISOString().slice(0, 10);
