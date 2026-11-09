import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const astro = join(root, 'node_modules', '.bin', 'astro');

/** Builds the fixture content set `name` with the real build. */
export function buildFixture(name) {
  const outDir = mkdtempSync(join(tmpdir(), `jds-${name}-`));
  const result = spawnSync(astro, ['build'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      JDS_CONTENT_DIR: join(root, 'test', 'fixtures', name),
      JDS_OUT_DIR: outDir,
      ASTRO_TELEMETRY_DISABLED: '1',
    },
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout}\n${result.stderr}`,
    has: (path) => existsSync(join(outDir, path)),
    read: (path) => readFileSync(join(outDir, path), 'utf8'),
  };
}
