import * as writing from './articles';
import * as research from './studies';
import * as projects from './projects';
import { dateOf, getNow, NOW_PATH } from './now';
import { absolute, pathIn, twinOf, type Language } from './translations';
import { uiOf } from './ui';

export const FEATURED_MAX = 3;
export const RECENT_MAX = 5;

export interface Piece {
  type: string;
  title: string;
  summary: string;
  published: string;
  path: string;
  twin: string;
}

/** Everything the home page in `language` shows besides its introduction: that language's pieces and Projects. */
export async function homeOf(language: Language) {
  const ui = uiOf(language);
  const pieces: (Piece & { featured: boolean; time: number })[] = [
    ...(await writing.getArticles(language)).map((a) => ({
      type: ui.article,
      title: a.data.title,
      summary: a.data.summary,
      published: writing.metadataOf(a).published,
      path: writing.pathOf(a),
      twin: writing.twinPathOf(a),
      featured: a.data.featured,
      time: a.data.published.getTime(),
    })),
    ...(await research.getStudies(language)).map((s) => ({
      type: ui.study,
      title: s.data.title,
      summary: s.data.summary,
      published: research.metadataOf(s).published,
      path: research.pathOf(s),
      twin: research.twinPathOf(s),
      featured: s.data.featured,
      time: s.data.published.getTime(),
    })),
  ].sort((a, b) => b.time - a.time || a.path.localeCompare(b.path));
  const now = await getNow(language);
  return {
    now: now && { entry: now, date: dateOf(now), path: pathIn(NOW_PATH, language) },
    featured: pieces.filter((p) => p.featured).slice(0, FEATURED_MAX),
    recent: pieces.slice(0, RECENT_MAX),
    active: (await projects.getProjects(language))
      .filter((p) => p.data.status === 'active')
      .map((p) => ({ name: p.data.name, oneLine: p.data.oneLine, version: p.data.version, path: projects.pathOf(p), twin: projects.twinPathOf(p) })),
  };
}

/** The home sections in `language` as Markdown, for the home page's twin. */
export async function homeMarkdown(language: Language): Promise<string> {
  const ui = uiOf(language);
  const { now, featured, recent, active } = await homeOf(language);
  const piece = (p: Piece) => `- ${p.type}, ${p.published}: [${p.title}](${absolute(p.twin)}): ${p.summary}`;
  return [
    ...(now ? [`## ${ui.now.title}`, '', `${ui.updated} ${now.date}. [${ui.now.title}](${absolute(twinOf(now.path))})`, '', (now.entry.body ?? '').trim(), ''] : []),
    ...(featured.length ? [`## ${ui.featured}`, '', ...featured.map(piece), ''] : []),
    ...(recent.length ? [`## ${ui.recent}`, '', ...recent.map(piece), ''] : []),
    ...(active.length
      ? [`## ${ui.activeProjects}`, '', ...active.map((p) => `- [${p.name}](${absolute(p.twin)}): ${p.oneLine}${p.version ? ` (${ui.version.toLowerCase()} ${p.version})` : ''}`), '']
      : []),
  ].join('\n').trimEnd();
}
