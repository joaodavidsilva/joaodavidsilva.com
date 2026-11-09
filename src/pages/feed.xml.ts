import type { APIRoute } from 'astro';
import { AUTHOR, FEED_PATH, SITE_URL } from '../../site.config.mjs';
import * as writing from '../lib/articles';
import * as research from '../lib/studies';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Dates are calendar days; Atom wants a date-time.
const timestamp = (day: string) => `${day}T00:00:00Z`;

/** The Atom feed of Articles and Studies, newest first, at FEED_PATH (a stable public URL; keep this file's name in step). */
export const GET: APIRoute = async () => {
  const entries = [
    ...(await writing.getArticles()).map(writing.metadataOf),
    ...(await research.getStudies()).map(research.metadataOf),
  ].sort((a, b) => b.published.localeCompare(a.published) || a.canonical.localeCompare(b.canonical));
  const updated = entries.map((e) => e.updated).sort().at(-1);
  const feedUrl = new URL(FEED_PATH, SITE_URL).href;
  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">',
    `  <id>${escape(feedUrl)}</id>`,
    `  <title>${escape(AUTHOR.name)}</title>`,
    '  <subtitle>Engineering beyond implementation.</subtitle>',
    `  <link rel="self" type="application/atom+xml" href="${escape(feedUrl)}"/>`,
    `  <link rel="alternate" type="text/html" href="${escape(new URL('/', SITE_URL).href)}"/>`,
    `  <updated>${updated ? timestamp(updated) : new Date().toISOString()}</updated>`,
    `  <author><name>${escape(AUTHOR.name)}</name><uri>${escape(AUTHOR.url)}</uri></author>`,
    ...entries.flatMap((entry) => [
      '  <entry>',
      `    <id>${escape(entry.canonical)}</id>`,
      `    <title>${escape(entry.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${escape(entry.canonical)}"/>`,
      `    <published>${timestamp(entry.published)}</published>`,
      `    <updated>${timestamp(entry.updated)}</updated>`,
      `    <summary>${escape(entry.summary)}</summary>`,
      ...entry.tags.map((tag) => `    <category term="${escape(tag)}"/>`),
      '  </entry>',
    ]),
    '</feed>',
    '',
  ].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
};
