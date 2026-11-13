import { getCollection } from 'astro:content';
import { langParam, languagesOf, originalIdOf, pathIn, type Language } from './translations';

/** A part of the site whose pages (an index, the home page, the feed) exist per language. */
export type Section = 'home' | 'writing' | 'research' | 'knowledge' | 'projects' | 'about' | 'now' | 'feed';

/**
 * The languages each section's generated pages exist in: an index (and the feed) exists in a
 * language as soon as it has something to list in it, so it never offers a missing Translation.
 */
async function load(): Promise<Record<Section, Language[]>> {
  const [pages, articles, series, studies, knowledge, projects, record, now] = await Promise.all([
    getCollection('pages'),
    getCollection('articles'),
    getCollection('series'),
    getCollection('studies'),
    getCollection('knowledge'),
    getCollection('projects'),
    getCollection('record'),
    getCollection('now'),
  ]);
  return {
    home: languagesOf(pages.filter((page) => originalIdOf(page) === 'index')),
    writing: languagesOf([...articles, ...series]),
    research: languagesOf(studies),
    knowledge: languagesOf(knowledge),
    projects: languagesOf(projects),
    about: languagesOf(record),
    now: languagesOf(now),
    feed: languagesOf([...articles, ...studies]),
  };
}

let cached: Promise<Record<Section, Language[]>> | undefined;

/** The languages the generated pages of `section` exist in, the original language first. */
export async function languagesOfSection(section: Section): Promise<Language[]> {
  cached ??= load();
  return (await cached)[section];
}

/** `path`, the English path of `section`'s page, in `language` where that page exists and in English otherwise. */
export async function sectionPathIn(section: Section, path: string, language: Language): Promise<string> {
  return (await languagesOfSection(section)).includes(language) ? pathIn(path, language) : path;
}

/** `getStaticPaths` params of a route under `[...lang]` for every language `section` exists in. */
export async function languageParams(section: Section) {
  return (await languagesOfSection(section)).map((language) => ({
    params: { lang: langParam(language) },
    props: { language },
  }));
}
