import { getCollection } from 'astro:content';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, pathOf } from './pages';
import type { Record, Source } from './record-schema';
import {
  assertTranslations, ORIGINAL_LANGUAGE, translationsOf as translationsAmong, type Language, type Translatable,
} from './translations';
import { uiOf, type Ui } from './ui';

export type { Record, Source };

export const ABOUT_PATH = '/about/';
const aboutPathOf = () => ABOUT_PATH;

/** Where the CV is published, by format; generated from the record at build time. */
export const CV_PATHS = { pdf: '/cv.pdf', docx: '/cv.docx' } as const;
export type CvFormat = keyof typeof CV_PATHS;

/** The file name a downloaded CV is saved under, e.g. `joao-david-silva-cv.pdf`. */
export function cvFileName(record: Record, format: CvFormat): string {
  const slug = record.name
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-cv.${format}`;
}

/** The record entry and its Translations (`<language>/record`), whose internal sources must resolve. */
async function getEntries(): Promise<(Translatable & { data: Record })[]> {
  const entries = (await getCollection('record')) as (Translatable & { data: Record })[];
  assertTranslations(entries, { pathOf: aboutPathOf });
  const paths = new Set([...(await getPages()).map(pathOf), ABOUT_PATH]);
  for (const { data } of entries) assertSources(data, paths);
  return entries;
}

/** The Professional record in `language`, or undefined when the content set has none. */
export async function getRecord(language: Language = ORIGINAL_LANGUAGE): Promise<Record | undefined> {
  return (await getEntries()).find((entry) => entry.data.language === language)?.data;
}

/** Every Professional record (the Original and its Translations) with its Translations, for the About pages. */
export async function getAllRecords() {
  const entries = await getEntries();
  return entries.map((entry) => ({ record: entry.data, translations: translationsAmong(entry, entries, aboutPathOf) }));
}

function assertSources(record: Record, paths: Set<string>) {
  const refs: { page?: string }[] = [
    ...record.roles, ...record.projects, ...record.achievements, ...record.publications, ...record.contributions,
  ].map((claim) => claim.source);
  refs.push(...record.skills.flatMap((skill) => skill.demonstrated));
  for (const ref of refs) {
    if (ref.page && !paths.has(ref.page)) {
      throw new Error(`record.yaml: source page "${ref.page}" does not exist on the site`);
    }
  }
}

export const currentRoles = (record: Record) => record.roles.filter((role) => !role.end);

/** Person JSON-LD, generated from the record alone. */
export function personOf(record: Record) {
  const [current] = currentRoles(record);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: record.name,
    description: record.headline,
    url: record.url,
    ...(record.email && { email: `mailto:${record.email}` }),
    ...(record.sameAs.length && { sameAs: record.sameAs }),
    ...(current && {
      jobTitle: current.title,
      worksFor: { '@type': 'Organization', name: current.organisation },
    }),
    ...(record.skills.length && { knowsAbout: record.skills.map((skill) => skill.name) }),
    ...(record.achievements.length && { award: record.achievements.map((a) => a.text) }),
  };
}

/** Paragraphs of one of João's prose fields; empty when he has not written it. */
export const paragraphsOf = (prose: string | undefined) =>
  (prose ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export function hrefOf(source: { page: string } | { url: string }): string {
  return 'page' in source ? source.page : source.url;
}

export const absoluteUrl = (href: string) => new URL(href, SITE_URL).href;

export const periodOf = (role: Record['roles'][number], ui: Ui = uiOf(ORIGINAL_LANGUAGE)) =>
  `${role.start} – ${role.end ?? ui.record.present}`;

/** The About page as Markdown, from the same record as the HTML. */
export function aboutMarkdown(record: Record): string {
  const ui = uiOf(record.language);
  const words = ui.record;
  const sourceMd = (source: Source) =>
    'attested' in source ? `(${words.attested}: ${source.attested})` : `([${words.source}](${absoluteUrl(hrefOf(source))}))`;
  const cv = `${words.downloadCv} [PDF](${absoluteUrl(CV_PATHS.pdf)}), [DOCX](${absoluteUrl(CV_PATHS.docx)})`;
  const out = [`${record.name}. ${record.headline}`, '', cv, ''];
  const section = (title: string, lines: string[]) => {
    if (lines.length) out.push(`## ${title}`, '', ...lines, '');
  };
  section(words.interests, paragraphsOf(record.interests).flatMap((p, i) => (i ? ['', p] : [p])));
  section(words.approach, paragraphsOf(record.approach).flatMap((p, i) => (i ? ['', p] : [p])));
  section(words.roles, record.roles.map((r) => `- ${r.title}, ${r.organisation}, ${periodOf(r, ui)}. ${sourceMd(r.source)}`));
  section(words.projects, record.projects.map((p) => `- ${p.name}: ${p.summary} ${sourceMd(p.source)}`));
  section(
    words.skills,
    record.skills.map(
      (s) => `- ${s.name}, ${words.demonstratedIn} ${s.demonstrated.map((d) => `<${absoluteUrl(hrefOf(d))}>`).join(', ')}`,
    ),
  );
  section(words.achievements, record.achievements.map((a) => `- ${a.text} ${sourceMd(a.source)}`));
  section(words.publications, record.publications.map((p) => `- ${p.title} ${sourceMd(p.source)}`));
  section(words.contributions, record.contributions.map((c) => `- ${c.text} ${sourceMd(c.source)}`));
  if (record.sameAs.length) section(words.elsewhere, record.sameAs.map((url) => `- <${url}>`));
  return out.join('\n').trimEnd();
}
