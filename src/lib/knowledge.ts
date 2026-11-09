import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { KNOWLEDGE_CATEGORIES, SITE_URL, SKILLS_REPO_URL } from '../../site.config.mjs';
import { lastCommitDayOf } from './git';

export type Entry = CollectionEntry<'knowledge'>;

/** A Knowledge Base entry with its build-time checked links resolved. */
export interface KnowledgeEntry {
  entry: Entry;
  related: Entry[];
  /** URL of the Guide's Skill `SKILL.md`, if it has one. */
  skillUrl?: string;
  /** YYYY-MM-DD of the last commit touching the source file. */
  updated: string;
}

// The build clones the skills repo here (scripts/ci-build.sh); tests point it at a fixture.
const skillsDir = resolve(process.env.JDS_SKILLS_DIR ?? '.skills');

export const pathOf = (entry: Entry) => `/knowledge/${entry.id}/`;
export const twinPathOf = (entry: Entry) => `/knowledge/${entry.id}.md`;
export const canonicalOf = (entry: Entry) => new URL(pathOf(entry), SITE_URL).href;
export const tagPathOf = (tag: string) => `/knowledge/tags/${slugify(tag)}/`;
export const categoryIdOf = (category: string) => slugify(category);

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Skill name → SKILL.md path relative to the skills repo, for `skills/<group>/<name>/SKILL.md`. */
function skillIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const root = join(skillsDir, 'skills');
  if (!existsSync(root)) return index;
  for (const file of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    const parts = file.split(/[\\/]/);
    if (parts.at(-1) === 'SKILL.md' && parts.length >= 2) {
      index.set(parts.at(-2)!, relative(skillsDir, join(root, file)).split(/[\\/]/).join('/'));
    }
  }
  return index;
}

/** "Last updated" from git history; an uncommitted entry is being written now. */
function lastUpdated(filePath: string | undefined): string {
  return (filePath && lastCommitDayOf(filePath)) || new Date().toISOString().slice(0, 10);
}

let cached: Promise<KnowledgeEntry[]> | undefined;

/** Every entry, after checking cross-references and Skill references; sorted by title. */
export function getKnowledge(): Promise<KnowledgeEntry[]> {
  cached ??= load();
  return cached;
}

async function load(): Promise<KnowledgeEntry[]> {
  const entries = await getCollection('knowledge');
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const skills = entries.some((entry) => entry.data.skill) ? skillIndex() : new Map<string, string>();
  return entries
    .map((entry) => {
      const related = entry.data.related.map((id) => {
        const target = byId.get(id);
        if (!target) throw new Error(`${entry.filePath}: related entry "${id}" does not exist`);
        return target;
      });
      let skillUrl: string | undefined;
      if (entry.data.skill) {
        const path = skills.get(entry.data.skill);
        if (!path) {
          throw new Error(
            `${entry.filePath}: skill "${entry.data.skill}" not found in the skills repo (${skillsDir})`,
          );
        }
        skillUrl = `${SKILLS_REPO_URL}/blob/main/${path}`;
      }
      return { entry, related, skillUrl, updated: lastUpdated(entry.filePath) };
    })
    .sort((a, b) => a.entry.data.title.localeCompare(b.entry.data.title));
}

/** Entries grouped by category, in the fixed category order, omitting empty categories. */
export function byCategory(entries: KnowledgeEntry[]) {
  return KNOWLEDGE_CATEGORIES.map((category) => ({
    category,
    id: categoryIdOf(category),
    entries: entries.filter(({ entry }) => entry.data.category === category),
  })).filter((group) => group.entries.length > 0);
}

/** Every tag in use, sorted. */
export function tagsOf(entries: KnowledgeEntry[]): string[] {
  return [...new Set(entries.flatMap(({ entry }) => entry.data.tags))].sort();
}

/** Markdown list of entries, used by the index and tag twins. */
export function markdownList(entries: KnowledgeEntry[]): string {
  return entries.map(({ entry }) => `- [${entry.data.title}](${pathOf(entry)}): ${entry.data.summary}`).join('\n');
}
