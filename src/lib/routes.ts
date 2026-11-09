// `getStaticPaths` of the routes under `src/pages/[...lang]/`, shared by each page and its
// Markdown twin: every Original at its path, every Translation under its language's prefix.
import * as articles from './articles';
import { getAllKnowledge, slugify, tagsOf, type KnowledgeEntry } from './knowledge';
import { getAllNow, translationsOf as nowTranslationsOf } from './now';
import * as projects from './projects';
import { getAllRecords } from './record';
import { getAllSeries, getSeries, positionOf } from './series';
import * as studies from './studies';
import { langParam, languagesOf, originalIdOf, type Language } from './translations';

export async function articleRoutes() {
  const all = await articles.getAllArticles();
  const seriesByLanguage = new Map(
    await Promise.all(languagesOf(all).map(async (language) => [language, await getSeries(language)] as const)),
  );
  return all.map((article) => ({
    params: { lang: langParam(article.data.language), slug: originalIdOf(article) },
    props: {
      article,
      position: positionOf(article, seriesByLanguage.get(article.data.language)!),
      translations: articles.translationsOf(article, all),
    },
  }));
}

export async function seriesRoutes() {
  return (await getAllSeries()).map((series) => ({
    params: { lang: langParam(series.entry.data.language), slug: originalIdOf(series.entry) },
    props: { series },
  }));
}

export async function studyRoutes() {
  const [all, allArticles] = await Promise.all([studies.getAllStudies(), articles.getAllArticles()]);
  return all.map((study) => ({
    params: { lang: langParam(study.data.language), slug: originalIdOf(study) },
    props: { study, discussedIn: studies.discussedInOf(study, allArticles), translations: studies.translationsOf(study, all) },
  }));
}

export async function knowledgeRoutes() {
  return (await getAllKnowledge()).map((item) => ({
    params: { lang: langParam(item.entry.data.language), id: originalIdOf(item.entry) },
    props: { item },
  }));
}

/** One page per tag in use per language, listing that language's entries tagged with it. */
export async function tagRoutes() {
  const all = await getAllKnowledge();
  return languagesOf(all.map(({ entry }) => entry)).flatMap((language: Language) => {
    const entries = all.filter(({ entry }) => entry.data.language === language);
    return tagsOf(entries).map((tag) => ({
      params: { lang: langParam(language), tag: slugify(tag) },
      props: { tag, language, entries: entries.filter(({ entry }) => entry.data.tags.includes(tag)) as KnowledgeEntry[] },
    }));
  });
}

export async function projectRoutes() {
  const all = await projects.getAllProjects();
  return all.map((project) => ({
    params: { lang: langParam(project.data.language), slug: originalIdOf(project) },
    props: { project, translations: projects.translationsOf(project, all) },
  }));
}

/** The Now pages: none when the content set has no Now entry. */
export async function nowRoutes() {
  const all = await getAllNow();
  return all.map((now) => ({
    params: { lang: langParam(now.data.language) },
    props: { now, translations: nowTranslationsOf(now, all) },
  }));
}

/** The About pages: none when the content set has no Professional record. */
export async function aboutRoutes() {
  return (await getAllRecords()).map(({ record, translations }) => ({
    params: { lang: langParam(record.language) },
    props: { record, translations },
  }));
}
