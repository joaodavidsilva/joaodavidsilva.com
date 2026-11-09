import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, cpSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const astro = join(root, 'node_modules', '.bin', 'astro');

/** Builds the fixture content set `name` with the real build. */
export function buildFixture(name) {
  return buildContent(name, join(root, 'test', 'fixtures', name));
}

/** Builds the site's real content with the real build. */
export function buildSite() {
  return buildContent('site', join(root, 'content'));
}

/**
 * Builds the fixture content set `name` from a scratch git repository, so dates
 * derived from git history are known. `history` is a list of commits, oldest
 * first: the first adds every file; each later one appends a line to `touch`.
 */
export function buildFixtureWithHistory(name, history) {
  const dir = mkdtempSync(join(tmpdir(), `jds-${name}-content-`));
  cpSync(join(root, 'test', 'fixtures', name), dir, { recursive: true });
  const git = (args, date) =>
    execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      stdio: 'ignore',
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.com',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.com',
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
      },
    });
  git(['init', '--quiet']);
  for (const { date, touch = [] } of history) {
    for (const path of touch) appendFileSync(join(dir, path), '\n');
    git(['add', '--all'], date);
    git(['commit', '--quiet', '--message', `Fixture at ${date}`], date);
  }
  return buildContent(name, dir);
}

/** Builds the content set in `contentDir` (holding `pages/`) with the real build. */
export function buildContent(name, contentDir) {
  const outDir = mkdtempSync(join(tmpdir(), `jds-${name}-`));
  const result = spawnSync(astro, ['build'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      JDS_CONTENT_DIR: contentDir,
      JDS_OUT_DIR: outDir,
      // The skills repo is substituted by a local fixture: no network in tests.
      JDS_SKILLS_DIR: join(root, 'test', 'fixtures', 'skills-repo'),
      ASTRO_TELEMETRY_DISABLED: '1',
    },
  });
  return {
    ok: result.status === 0,
    dir: outDir,
    output: `${result.stdout}\n${result.stderr}`,
    has: (path) => existsSync(join(outDir, path)),
    read: (path) => readFileSync(join(outDir, path), 'utf8'),
    bytes: (path) => readFileSync(join(outDir, path)),
  };
}
