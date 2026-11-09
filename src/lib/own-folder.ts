import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { originalIdOf, type Translatable } from './translations';

/**
 * A long-form entry (Article, Study) whose own folder, `<collection>/<id>/`, sits beside
 * its `<collection>/<id>.md` and holds its images and files. A Translation shares its
 * Original's own folder.
 */
type Entry = Translatable;

/** The entry's own folder (its Original's), relative to the project. */
export const folderOf = (entry: Entry) =>
  join(entry.filePath!.slice(0, -`${entry.id}.md`.length), originalIdOf(entry));

/** Every file in the entry's own folder, to be published beside its page. */
export function folderFilesOf(entry: Entry): { file: string; source: string }[] {
  const folder = resolve(folderOf(entry));
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((child) => child.isFile())
    .map((child) => ({ file: child.name, source: join(folder, child.name) }));
}

/**
 * "CSV, 32 bytes" for `file` in the entry's own folder (the link downloads it under its
 * name); a missing file fails the build, naming what referenced it (`kind`, such as "attachment").
 */
export function describeFolderFile(entry: Entry, file: string, kind: string): string {
  const source = resolve(folderOf(entry), file);
  if (!existsSync(source)) {
    throw new Error(`${entry.filePath}: ${kind} "${file}" not found in ${folderOf(entry)}/`);
  }
  const type = extname(file).slice(1).toUpperCase() || 'file';
  return `${type}, ${sizeOf(source)}`;
}

function sizeOf(file: string): string {
  const bytes = statSync(file).size;
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Minutes an unhurried reader needs for the body, at about 230 words a minute. */
export function readingMinutesOf(entry: { body?: string }): number {
  const words = (entry.body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}
