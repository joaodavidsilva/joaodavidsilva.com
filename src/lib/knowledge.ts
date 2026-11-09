import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { KNOWLEDGE_CATEGORIES, SKILLS_REPO_URL } from '../../site.config.mjs';
import { lastCommitDayOf } from './git';
import {
  absolute, alternateAt, assertTranslations, inLanguage, isTranslation, locate, pathIn, ORIGINAL_LANGUAGE,
  translationsOf as translationsAmong, type Language, type Translations,
} from './translations';
import { uiOf } from './ui';

export type Entry = CollectionEntry<'knowledge'>;

/** A Knowledge Base entry with its build-time checked links resolved. */
export interface KnowledgeEntry {
  entry: Entry;
  /** Related entries in the entry's language: a related Original without that Translation is left out. */
  related: Entry[];
  /** URL of the Guide's Skill `SKILL.md`, if it has one. */
  skillUrl?: string;
  /** YYYY-MM-DD of the last commit touching the source file. */
  updated: string;
  translations: Translations;
}

// The build clones the skills repo here (scripts/ci-build.sh); tests point it at a fixture.
const skillsDir = resolve(process.env.JDS_SKILLS_DIR ?? '.skills');

/** Where the entry with id `id` is published, in English. */
const entryPathOf = (id: string) => `/knowledge/${id}/`;

/** The Knowledge index in `language`. */
export function knowledgeIndexOf(language: Language) {
  return { ...uiOf(language).knowledge, ...alternateAt('/knowledge/', language) };
}

export const pathOf = (entry: Entry) => locate(entry, entryPathOf).path;
export const twinPathOf = (entry: Entry) => locate(entry, entryPathOf).twin;
export const canonicalOf = (entry: Entry) => locate(entry, entryPathOf).canonical;
/** The page listing the entries in `language` tagged `tag`. */
export const tagPathOf = (tag: string, language: Language) => pathIn(`/knowledge/tags/${slugify(tag)}/`, language);
export const categoryIdOf = (category: string) => slugify(category);

export function slugify(text: string): string {
  return text.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

/** Every entry and Translation, after checking cross-references and Skill references; sorted by title. */
export function getAllKnowledge(): Promise<KnowledgeEntry[]> {
  cached ??= load();
  return cached;
}

/** Every entry in `language`, sorted by title. */
export async function getKnowledge(language: Language = ORIGINAL_LANGUAGE): Promise<KnowledgeEntry[]> {
  return (await getAllKnowledge()).filter(({ entry }) => entry.data.language === language);
}

async function load(): Promise<KnowledgeEntry[]> {
  const entries = await getCollection('knowledge');
  assertTranslations(entries, { pathOf: entryPathOf, same: ['kind', 'category', 'related', 'skill'] });
  const byId = new Map(entries.filter((entry) => !isTranslation(entry)).map((entry) => [entry.id, entry]));
  const skills = entries.some((entry) => entry.data.skill) ? skillIndex() : new Map<string, string>();
  return entries
    .map((entry) => {
      const related = entry.data.related.flatMap((id) => {
        const target = byId.get(id);
        if (!target) throw new Error(`${entry.filePath}: related entry "${id}" does not exist`);
        return inLanguage(target, entry.data.language, entries) ?? [];
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
      return {
        entry,
        related,
        skillUrl,
        updated: lastUpdated(entry.filePath),
        translations: translationsAmong(entry, entries, entryPathOf),
      };
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

/** Markdown list of entries linking their twins, used by the index and tag twins. */
export function markdownList(entries: KnowledgeEntry[]): string {
  return entries.map(({ entry }) => `- [${entry.data.title}](${absolute(twinPathOf(entry))}): ${entry.data.summary}`).join('\n');
}
