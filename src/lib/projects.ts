import { getImage } from 'astro:assets';
import { getCollection, getEntries, type CollectionEntry } from 'astro:content';
import { LANGUAGES } from '../../site.config.mjs';
import { listingDatesOf, metadataOf as sharedMetadataOf, type Metadata } from './metadata';
import { getPages, pathOf as pagePathOf } from './pages';
import {
  alternateAt, assertTranslations, inLanguage, locate, ORIGINAL_LANGUAGE, pathIn, translationsOf as translationsAmong,
  type Language,
} from './translations';
import { uiOf, type Ui } from './ui';

export type Project = CollectionEntry<'projects'>;
type Status = Project['data']['status'];

export const PROJECTS_PATH = '/projects/';

/** Where the Project with id `id` is published, in English. */
const projectPathOf = (id: string) => `${PROJECTS_PATH}${id}/`;

/** The Projects index in `language`. */
export function projectsIndexOf(language: Language) {
  return { ...uiOf(language).projects, ...alternateAt(PROJECTS_PATH, language) };
}

/** The order Projects are listed in: what is alive first. */
const STATUS_ORDER: Status[] = ['active', 'in development', 'paused', 'archived'];

export const pathOf = (project: Project) => locate(project, projectPathOf).path;
export const twinPathOf = (project: Project) => locate(project, projectPathOf).twin;
export const canonicalOf = (project: Project) => locate(project, projectPathOf).canonical;
export const translationsOf = (project: Project, projects: Project[]) => translationsAmong(project, projects, projectPathOf);

/**
 * Every Project and Translation in listing order, after enforcing that no page claims an
 * index or a Project page path.
 */
export async function getAllProjects(): Promise<Project[]> {
  const projects = await getCollection('projects');
  assertTranslations(projects, { pathOf: projectPathOf, same: ['status', 'version', 'links', 'software', 'legal', 'waitlist'] });
  const indexes = (Object.keys(LANGUAGES) as Language[]).map((language) => pathIn(PROJECTS_PATH, language));
  const owned = new Set([...indexes, ...projects.map(pathOf)]);
  for (const page of await getPages()) {
    const path = pagePathOf(page);
    if (owned.has(path)) {
      throw new Error(
        `${page.filePath}: path "${path}" belongs to ${indexes.includes(path) ? 'the Projects index' : 'a Project page'}`,
      );
    }
  }
  return projects.sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.data.status) - STATUS_ORDER.indexOf(b.data.status) ||
      a.data.name.localeCompare(b.data.name),
  );
}

/** Every Project in `language`, in listing order. */
export async function getProjects(language: Language = ORIGINAL_LANGUAGE): Promise<Project[]> {
  return (await getAllProjects()).filter((project) => project.data.language === language);
}

/** The external links of a Project, labelled in `ui`'s language, in display order. */
export function linksOf(project: Project, ui: Ui): { label: string; url: string }[] {
  const { site, repository, stores } = project.data.links;
  return [
    ...(site ? [{ label: ui.website, url: site }] : []),
    ...(repository ? [{ label: ui.sourceCode, url: repository }] : []),
    ...stores.map(({ name, url }) => ({ label: name, url })),
  ];
}

/**
 * The legal documents of a Project: pages that keep their own URLs, in the Project's language
 * where translated and in English otherwise.
 */
export async function legalOf(project: Project): Promise<{ title: string; path: string; language: Language }[]> {
  const [documents, pages] = await Promise.all([getEntries(project.data.legal), getPages()]);
  return documents.map((page, i) => {
    if (!page) throw new Error(`${project.filePath}: legal document "${project.data.legal[i].id}" is not a page`);
    if (!page.data.legal) throw new Error(`${page.filePath}: a Project's legal document must set legal: true`);
    const document = inLanguage(page, project.data.language, pages) ?? page;
    return { title: document.data.title, path: pagePathOf(document), language: document.data.language };
  });
}

/** The figures of a Project as built images, so the page, its twin and its JSON-LD share one URL. */
export async function figuresOf(project: Project) {
  return Promise.all(
    project.data.figures.map(async ({ src, alt, caption }) => {
      const image = await getImage({ src });
      return { src: image.src, attributes: image.attributes, alt, caption };
    }),
  );
}

/** The metadata shared by the JSON-LD and the Markdown twin front-matter. */
export function metadataOf(project: Project) {
  const { name, oneLine, status, version } = project.data;
  return { ...sharedMetadataOf(project, projectPathOf, { title: name, summary: oneLine }), status, version };
}

/** The Projects index's shared metadata, dated by the Projects it lists. */
export function indexMetadataOf(language: Language, projects: Project[]): Metadata {
  const { title, summary, canonical } = projectsIndexOf(language);
  return { title, summary, ...listingDatesOf(projects.map(metadataOf)), language, tags: [], canonical };
}
