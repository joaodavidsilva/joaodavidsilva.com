import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const wranglerConfig = () => JSON.parse(
  readFileSync(new URL('wrangler.jsonc', root), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

test('the Worker serves the built site as static assets on the apex domain', () => {
  const config = wranglerConfig();
  assert.equal(config.name, 'joaodavidsilva');
  assert.match(config.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.html_handling, 'force-trailing-slash');
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.deepEqual(config.routes, [{ pattern: 'joaodavidsilva.com', custom_domain: true }]);
  assert.equal(config.preview_urls, true);
});

test('only /api/ reaches the Waitlist Worker; everything else is a static asset', () => {
  const config = wranglerConfig();
  assert.equal(config.main, './worker/index.js');
  assert.deepEqual(config.assets.run_worker_first, ['/api/*']);
  assert.equal(config.assets.binding, undefined, 'the Worker never serves the site itself');
});

test('no secrets are committed', () => {
  const config = wranglerConfig();
  assert.deepEqual(config.secrets.required, ['TURNSTILE_SECRET_KEY']);
  assert.ok(!('TURNSTILE_SECRET_KEY' in (config.vars ?? {})), 'the Turnstile secret is a Wrangler secret');
  const ignored = readFileSync(new URL('.gitignore', root), 'utf8').split('\n');
  for (const file of ['.dev.vars*', '.env*', '.wrangler/']) assert.ok(ignored.includes(file), `${file} is not ignored`);
  const tracked = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).stdout.split('\n');
  assert.deepEqual(tracked.filter((f) => /(^|\/)(\.dev\.vars|\.env)/.test(f)), []);
});

test('the Workers Builds build command runs every check before building', () => {
  assert.equal(pkg.scripts['ci:build'], 'sh scripts/ci-build.sh');
  const script = readFileSync(new URL('scripts/ci-build.sh', root), 'utf8');
  assert.match(script, /set -eu/);
  assert.match(script, /git fetch .*--unshallow/);
  assert.ok(script.indexOf('pnpm test') < script.indexOf('pnpm build'), 'tests gate the build');
  assert.match(pkg.devDependencies.wrangler, /^\d+\.\d+\.\d+$/, 'wrangler pinned exactly');
});

test('the build command unshallows a shallow clone and reports full history', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jds-ci-'));
  try {
    const clone = join(dir, 'clone');
    const git = (...args) => spawnSync('git', args, { encoding: 'utf8' });
    const r = git('clone', '--quiet', '--depth=1', `file://${new URL('.', root).pathname}`, clone);
    assert.equal(r.status, 0, r.stderr);
    const out = spawnSync('sh', [new URL('scripts/ci-build.sh', root).pathname], {
      cwd: clone, encoding: 'utf8', env: { ...process.env, JDS_CI_HISTORY_ONLY: '1' },
    });
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /git history: full \(\d+ commits\)/);
    assert.equal(git('-C', clone, 'rev-parse', '--is-shallow-repository').stdout.trim(), 'false');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
