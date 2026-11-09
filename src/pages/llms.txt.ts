import type { APIRoute } from 'astro';
import * as writing from '../lib/articles';
import * as research from '../lib/studies';
import { getAllSeries, twinPathOf as seriesTwinPathOf } from '../lib/series';
import * as projects from '../lib/projects';
import { getKnowledge, tagMetadataOf, tagPathOf, tagsOf, twinPathOf as knowledgeTwinPathOf } from '../lib/knowledge';
import { getAllNow, NOW_PATH, translationsOf as nowTranslationsOf } from '../lib/now';
import { getPages, translationsOf as pageTranslationsOf, twinPathOf } from '../lib/pages';
import { ABOUT_PATH, getAllRecords } from '../lib/record';
import { languagesOfSection, type Section } from '../lib/sections';
import {
  absolute, generatedTranslations, isTranslation, translationPointer, twinOf, type Translations,
} from '../lib/translations';
import { uiOf } from '../lib/ui';

/** One Original: its title linking its twin, its summary, then its Translations' twins. */
const line = (title: string, twin: string, summary: string, translations: Translations) =>
  `- [${title}](${absolute(twin)}): ${summary}${translationPointer(translations)}`;

const en = uiOf('en');

/** The line of a section's index, pointing to the index in every language it exists in. */
async function indexLine(section: Section, path: string, { title, summary }: { title: string; summary: string }) {
  return line(title, twinOf(path), summary, generatedTranslations(path, await languagesOfSection(section)));
}

/** Every Original with a one-line summary, pointing to its available Translations (ADR-0005). */
export const GET: APIRoute = async () => {
  const pages = await getPages();
  const lines = pages
    .filter((page) => !isTranslation(page))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((page) => line(page.data.title, twinPathOf(page), page.data.summary, pageTranslationsOf(page, pages)));
  const allNow = await getAllNow();
  for (const now of allNow.filter((one) => !isTranslation(one))) {
    lines.push(line(en.now.title, twinOf(NOW_PATH), en.now.summary, nowTranslationsOf(now, allNow)));
  }
  for (const { record, translations } of (await getAllRecords()).filter(({ record }) => record.language === 'en')) {
    lines.push(line(en.about, twinOf(ABOUT_PATH), `${record.name}. ${record.headline}`, translations));
  }

  const allArticles = await writing.getAllArticles();
  const articles = allArticles
    .filter((article) => !isTranslation(article))
    .map((article) => line(article.data.title, writing.twinPathOf(article), article.data.summary, writing.translationsOf(article, allArticles)));
  const series = (await getAllSeries())
    .filter(({ entry }) => !isTranslation(entry))
    .map((one) => line(one.entry.data.title, seriesTwinPathOf(one), one.entry.data.summary, one.translations));
  const allStudies = await research.getAllStudies();
  const studies = allStudies
    .filter((study) => !isTranslation(study))
    .map((study) =>
      line(study.data.title, research.twinPathOf(study), `${study.data.summary} (${study.data.status})`, research.translationsOf(study, allStudies)),
    );
  const allProjects = await projects.getAllProjects();
  const projectLines = allProjects
    .filter((project) => !isTranslation(project))
    .map((project) => line(project.data.name, projects.twinPathOf(project), project.data.oneLine, projects.translationsOf(project, allProjects)));
  const allKnowledge = await getKnowledge();
  const knowledge = allKnowledge.map(({ entry, translations }) =>
    line(entry.data.title, knowledgeTwinPathOf(entry), entry.data.summary, translations),
  );
  // Tags differ between languages, so a tag page has no Translations to point to.
  for (const tag of tagsOf(allKnowledge)) {
    const { title, summary } = tagMetadataOf(tag, 'en', []);
    knowledge.push(line(title, twinOf(tagPathOf(tag, 'en')), summary, generatedTranslations(tagPathOf(tag, 'en'), [])));
  }
  const body = [
    '# João David Silva',
    '',
    '> Engineering beyond implementation. An independent engineering publication.',
    '',
    '## Pages',
    '',
    ...lines,
    '',
    ...(articles.length || series.length ? ['## Writing', '', await indexLine('writing', '/writing/', en.writing), ...series, ...articles, ''] : []),
    ...(studies.length ? ['## Research', '', await indexLine('research', '/research/', en.research), ...studies, ''] : []),
    ...(projectLines.length ? ['## Projects', '', await indexLine('projects', '/projects/', en.projects), ...projectLines, ''] : []),
    ...(knowledge.length ? ['## Knowledge', '', await indexLine('knowledge', '/knowledge/', en.knowledge), ...knowledge, ''] : []),
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
