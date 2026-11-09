import { getCollection } from 'astro:content';
import { SITE_URL } from '../../site.config.mjs';
import * as articles from './articles';
import { lastCommitDayOf } from './git';
import { getAllKnowledge, pathOf as knowledgePathOf, tagPathOf, tagsOf } from './knowledge';
import { getAllNow, NOW_PATH } from './now';
import { getPages, pathOf as pagePathOf } from './pages';
import * as projects from './projects';
import { getAllSeries, pathOf as seriesPathOf } from './series';
import * as studies from './studies';
import type { ProfessionalRecord, Source } from './record-schema';
import {
  assertTranslations, languagesOf, ORIGINAL_LANGUAGE, pathIn, translationsOf as translationsAmong, type Language, type Translatable,
} from './translations';
import { uiOf, type Ui } from './ui';

export type { ProfessionalRecord, Source };

export const ABOUT_PATH = '/about/';
const aboutPathOf = () => ABOUT_PATH;

/** Where the CV is published, by format; generated from the record at build time. */
export const CV_PATHS = { pdf: '/cv.pdf', docx: '/cv.docx' } as const;
export type CvFormat = keyof typeof CV_PATHS;

/** The file name a downloaded CV is saved under, e.g. `joao-david-silva-cv.pdf`. */
export function cvFileName(record: ProfessionalRecord, format: CvFormat): string {
  const slug = record.name
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-cv.${format}`;
}

/** The record entry and its Translations (`<language>/record`), whose internal sources must resolve. */
async function getEntries(): Promise<(Translatable & { data: ProfessionalRecord })[]> {
  const entries = (await getCollection('record')) as (Translatable & { data: ProfessionalRecord })[];
  assertTranslations(entries, { pathOf: aboutPathOf });
  const pages = await publishedPages(entries);
  for (const { data } of entries) assertSources(data, pages);
  return entries;
}

/** Every page the site publishes, in every language, by path with its title: what a Claim's `page` source may point at. */
async function publishedPages(records: Translatable[]): Promise<Map<string, string>> {
  const [pages, allArticles, allSeries, allStudies, allProjects, knowledge, now] = await Promise.all([
    getPages(), articles.getAllArticles(), getAllSeries(), studies.getAllStudies(), projects.getAllProjects(),
    getAllKnowledge(), getAllNow(),
  ]);
  const entries = knowledge.map(({ entry }) => entry);
  const at = (path: string, among: Translatable[], title: (ui: Ui) => string) =>
    languagesOf(among).map((language) => [pathIn(path, language), title(uiOf(language))] as const);
  return new Map([
    ...pages.map((page) => [pagePathOf(page), page.data.title] as const),
    ...allArticles.map((article) => [articles.pathOf(article), article.data.title] as const),
    ...allSeries.map((series) => [seriesPathOf(series), series.entry.data.title] as const),
    ...allStudies.map((study) => [studies.pathOf(study), study.data.title] as const),
    ...allProjects.map((project) => [projects.pathOf(project), project.data.name] as const),
    ...entries.map((entry) => [knowledgePathOf(entry), entry.data.title] as const),
    ...languagesOf(entries).flatMap((language) =>
      tagsOf(knowledge.filter(({ entry }) => entry.data.language === language))
        .map((tag) => [tagPathOf(tag, language), uiOf(language).tagged(tag)] as const),
    ),
    ...at('/writing/', [...allArticles, ...allSeries.map(({ entry }) => entry)], (ui) => ui.writing.title),
    ...at('/research/', allStudies, (ui) => ui.research.title),
    ...at(projects.PROJECTS_PATH, allProjects, (ui) => ui.projects.title),
    ...at('/knowledge/', entries, (ui) => ui.knowledge.title),
    ...at(NOW_PATH, now, (ui) => ui.now.title),
    ...at(ABOUT_PATH, records, (ui) => ui.about),
  ]);
}

/** The title of every page a Claim's `page` source may point at, by path, to name links to it. */
export const pageTitles = async () => publishedPages(await getCollection('record'));

/** The Professional record in `language`, or undefined when the content set has none. */
export async function getRecord(language: Language = ORIGINAL_LANGUAGE): Promise<ProfessionalRecord | undefined> {
  return (await getEntries()).find((entry) => entry.data.language === language)?.data;
}

/** Every Professional record (the Original and its Translations) with its Translations, for the About pages. */
export async function getAllRecords() {
  const entries = await getEntries();
  return entries.map((entry) => ({
    record: entry.data,
    translations: translationsAmong(entry, entries, aboutPathOf),
    /** YYYY-MM-DD of the last commit touching the record file, if it has one. */
    updated: entry.filePath && lastCommitDayOf(entry.filePath),
  }));
}

function assertSources(record: ProfessionalRecord, pages: Map<string, string>) {
  const refs: { page?: string }[] = [
    ...record.roles, ...record.projects, ...record.achievements, ...record.publications, ...record.contributions,
  ].map((claim) => claim.source);
  refs.push(...record.skills.flatMap((skill) => skill.demonstrated));
  for (const ref of refs) {
    if (ref.page && !pages.has(ref.page)) {
      throw new Error(`record.yaml: source page "${ref.page}" does not exist on the site`);
    }
  }
}

export const currentRoles = (record: ProfessionalRecord) => record.roles.filter((role) => !role.end);

/** Person JSON-LD, generated from the record alone. */
export function personOf(record: ProfessionalRecord) {
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

/** A role's period in `ui`'s language with months in words, such as "Apr 2023 – present". */
export function periodOf(role: ProfessionalRecord['roles'][number], ui: Ui = uiOf(ORIGINAL_LANGUAGE)): string {
  const format = new Intl.DateTimeFormat(ui.locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const month = (value: string) => {
    const [year, number] = value.split('-').map(Number);
    return format.format(Date.UTC(year, number - 1));
  };
  return `${month(role.start)} – ${role.end ? month(role.end) : ui.record.present}`;
}

/** The About page as Markdown, from the same record as the HTML. */
export function aboutMarkdown(record: ProfessionalRecord): string {
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
