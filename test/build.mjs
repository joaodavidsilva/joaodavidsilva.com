import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const astro = join(root, 'node_modules', '.bin', 'astro');

/** Builds the fixture content set `name` with the real build. */
export function buildFixture(name) {
  return build(name, join(root, 'test', 'fixtures', name));
}

/** Builds the site's real content with the real build. */
export function buildSite() {
  return build('site', join(root, 'content'));
}

/** Builds the content set in `contentDir` (for tests that make their own content) with the real build. */
export function buildContent(contentDir) {
  return build('content', contentDir);
}

function build(name, contentDir) {
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
