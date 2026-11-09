import * as writing from './articles';
import * as research from './studies';
import * as projects from './projects';
import { dateOf, getNow, NOW } from './now';

export const FEATURED_MAX = 3;
export const RECENT_MAX = 5;

export interface Piece {
  type: 'Article' | 'Study';
  title: string;
  summary: string;
  published: string;
  path: string;
  twin: string;
}

/** Everything the home page shows besides its introduction, derived from the collections. */
export async function homeOf() {
  const pieces: (Piece & { featured: boolean; time: number })[] = [
    ...(await writing.getArticles()).map((a) => ({
      type: 'Article' as const,
      title: a.data.title,
      summary: a.data.summary,
      published: a.data.published.toISOString().slice(0, 10),
      path: writing.pathOf(a),
      twin: writing.twinPathOf(a),
      featured: a.data.featured,
      time: a.data.published.getTime(),
    })),
    ...(await research.getStudies()).map((s) => ({
      type: 'Study' as const,
      title: s.data.title,
      summary: s.data.summary,
      published: s.data.published.toISOString().slice(0, 10),
      path: research.pathOf(s),
      twin: research.twinPathOf(s),
      featured: s.data.featured,
      time: s.data.published.getTime(),
    })),
  ].sort((a, b) => b.time - a.time || a.path.localeCompare(b.path));
  const now = await getNow();
  return {
    now,
    featured: pieces.filter((p) => p.featured).slice(0, FEATURED_MAX),
    recent: pieces.slice(0, RECENT_MAX),
    active: (await projects.getProjects())
      .filter((p) => p.data.status === 'active')
      .map((p) => ({ name: p.data.name, oneLine: p.data.oneLine, version: p.data.version, path: projects.pathOf(p), twin: projects.twinPathOf(p) })),
  };
}

/** The home sections as Markdown, for the home page's twin. */
export async function homeMarkdown(): Promise<string> {
  const { now, featured, recent, active } = await homeOf();
  const piece = (p: Piece) => `- ${p.type}, ${p.published}: [${p.title}](${p.twin}): ${p.summary}`;
  return [
    ...(now ? ['## Now', '', `Updated ${dateOf(now)}. [Now](${NOW.twin})`, '', (now.body ?? '').trim(), ''] : []),
    ...(featured.length ? ['## Featured', '', ...featured.map(piece), ''] : []),
    ...(recent.length ? ['## Recent', '', ...recent.map(piece), ''] : []),
    ...(active.length
      ? ['## Active projects', '', ...active.map((p) => `- [${p.name}](${p.twin}): ${p.oneLine}${p.version ? ` (version ${p.version})` : ''}`), '']
      : []),
  ].join('\n');
}
