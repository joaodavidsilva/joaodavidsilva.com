import { execFileSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';

/** The day (YYYY-MM-DD, UTC) of the last commit that changed `file`, if it has any. */
function lastCommitDayOf(file: string): string | undefined {
  const path = resolve(file);
  let committed: string;
  try {
    committed = execFileSync('git', ['log', '-1', '--format=%cI', '--', basename(path)], {
      cwd: dirname(path),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Not in a git repository: the file has no history.
    return undefined;
  }
  return committed ? new Date(committed).toISOString().slice(0, 10) : undefined;
}

/**
 * "Last updated" for a page: the day its source file last changed in git history,
 * never earlier than its publication day (YYYY-MM-DD). A file with no history yet
 * was last updated when it was published.
 */
export function lastUpdatedOf(file: string, published: string): string {
  const changed = lastCommitDayOf(file);
  return changed && changed > published ? changed : published;
}
