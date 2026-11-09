import type { APIRoute } from 'astro';
import { AUTHOR, FEED_PATH } from '../../../site.config.mjs';
import * as writing from '../../lib/articles';
import { escapeMarkup as escape } from '../../lib/escape';
import { languageParams, sectionPathIn } from '../../lib/sections';
import * as research from '../../lib/studies';
import { absolute, pathIn, type Language } from '../../lib/translations';


// Dates are calendar days; Atom wants a date-time.
const timestamp = (day: string) => `${day}T00:00:00Z`;

export const getStaticPaths = () => languageParams('feed');

/**
 * The Atom feed of Articles and Studies in one language, newest first, at FEED_PATH under the
 * language's prefix (a stable public URL; keep this file's name in step).
 */
export const GET: APIRoute = async ({ props }) => {
  const { language } = props as { language: Language };
  const entries = [
    ...(await writing.getArticles(language)).map(writing.metadataOf),
    ...(await research.getStudies(language)).map(research.metadataOf),
  ].sort((a, b) => b.published.localeCompare(a.published) || a.canonical.localeCompare(b.canonical));
  const updated = entries.map((e) => e.updated).sort().at(-1);
  const feedUrl = absolute(pathIn(FEED_PATH, language));
  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${language}">`,
    `  <id>${escape(feedUrl)}</id>`,
    `  <title>${escape(AUTHOR.name)}</title>`,
    '  <subtitle>Engineering beyond implementation.</subtitle>',
    `  <link rel="self" type="application/atom+xml" href="${escape(feedUrl)}"/>`,
    `  <link rel="alternate" type="text/html" href="${escape(absolute(await sectionPathIn('home', '/', language)))}"/>`,
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
