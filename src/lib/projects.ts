import { getImage } from 'astro:assets';
import { getCollection, getEntries, type CollectionEntry } from 'astro:content';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, pathOf as pagePathOf } from './pages';
import { ORIGINAL_LANGUAGE } from './translations';
import { lastUpdatedOf } from './git';

export type Project = CollectionEntry<'projects'>;

export const PROJECTS_PATH = '/projects/';
export const PROJECTS_TWIN_PATH = '/projects.md';
export const PROJECTS_TITLE = 'Projects';
export const PROJECTS_SUMMARY = 'What João David Silva maintains over time, with the status and latest version of each.';

/** The order Projects are listed in: what is alive first. */
const STATUS_ORDER: Project['data']['status'][] = ['active', 'in development', 'paused', 'archived'];

export const statusLabel = (status: Project['data']['status']) => status[0].toUpperCase() + status.slice(1);

export const pathOf = (project: Project) => `${PROJECTS_PATH}${project.id}/`;
export const twinPathOf = (project: Project) => `${PROJECTS_PATH}${project.id}.md`;
export const canonicalOf = (project: Project) => new URL(pathOf(project), SITE_URL).href;

/** Every Project in listing order, after enforcing that no page claims the index or a Project page path. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects');
  const owned = new Set([PROJECTS_PATH, ...projects.map(pathOf)]);
  for (const page of await getPages()) {
    const path = pagePathOf(page);
    if (owned.has(path)) {
      throw new Error(
        `${page.filePath}: path "${path}" belongs to ${path === PROJECTS_PATH ? 'the Projects index' : 'a Project page'}`,
      );
    }
  }
  return projects.sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.data.status) - STATUS_ORDER.indexOf(b.data.status) ||
      a.data.name.localeCompare(b.data.name),
  );
}

/** The external links of a Project, labelled, in display order. */
export function linksOf(project: Project): { label: string; url: string }[] {
  const { site, repository, stores } = project.data.links;
  return [
    ...(site ? [{ label: 'Website', url: site }] : []),
    ...(repository ? [{ label: 'Source code', url: repository }] : []),
    ...stores.map(({ name, url }) => ({ label: name, url })),
  ];
}

/** The legal documents of a Project: pages that keep their own URLs. */
export async function legalOf(project: Project): Promise<{ title: string; path: string }[]> {
  const pages = await getEntries(project.data.legal);
  return pages.map((page, i) => {
    if (!page) throw new Error(`${project.filePath}: legal document "${project.data.legal[i].id}" is not a page`);
    if (!page.data.legal) throw new Error(`${page.filePath}: a Project's legal document must set legal: true`);
    return { title: page.data.title, path: pagePathOf(page) };
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
  const { name, oneLine, status, version, published, tags } = project.data;
  const publishedDay = published.toISOString().slice(0, 10);
  return {
    title: name,
    summary: oneLine,
    published: publishedDay,
    updated: lastUpdatedOf(project.filePath!, publishedDay),
    language: ORIGINAL_LANGUAGE,
    tags,
    canonical: canonicalOf(project),
    status,
    version,
  };
}
