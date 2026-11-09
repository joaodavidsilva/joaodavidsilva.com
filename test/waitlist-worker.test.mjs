// Seam 2: the Waitlist Worker. HTTP request in, response and stored rows out, with the real Worker
// running in Cloudflare's local runtime (workerd) against a local D1 and Turnstile test keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestHarness } from 'wrangler';

const ORIGIN = 'https://joaodavidsilva.com';
const ENDPOINT = `${ORIGIN}/api/waitlist`;
// Cloudflare's documented Turnstile test secret keys.
const PASSES = '1x0000000000000000000000000000000AA';
const FAILS = '2x0000000000000000000000000000000AA';
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

// The real wrangler.jsonc, with paths made absolute and the assets pointed at an empty directory,
// so the Worker runs without a site build.
function configForTest() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const config = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  const dir = mkdtempSync(join(tmpdir(), 'jds-waitlist-'));
  mkdirSync(join(dir, 'assets'));
  config.main = join(root, config.main);
  config.assets.directory = join(dir, 'assets');
  for (const db of config.d1_databases) db.migrations_dir = join(root, db.migrations_dir);
  writeFileSync(join(dir, 'wrangler.json'), JSON.stringify(config));
  return join(dir, 'wrangler.json');
}

const harness = (secret) =>
  createTestHarness({
    workers: [{ configPath: configForTest(), secrets: { TURNSTILE_SECRET_KEY: secret } }],
  });

const signUp = (server, fields = {}, init = {}) =>
  server.fetch(ENDPOINT, {
    method: 'POST',
    headers: { Origin: ORIGIN },
    body: new URLSearchParams({
      email: 'reader@example.com',
      consent: 'yes',
      source: 'lozza',
      'cf-turnstile-response': TOKEN,
      ...fields,
    }),
    ...init,
  });

const rowsOf = async (server) => {
  const { DB } = await server.getWorker().getEnv();
  const { results } = await DB.prepare('SELECT * FROM signups ORDER BY id').all();
  return results;
};

test('the Waitlist Worker', async (t) => {
  const server = harness(PASSES);
  t.after(() => server.close());
  await server.listen();
  await server.getWorker().applyD1Migrations('DB');
  t.beforeEach(async () => {
    const { DB } = await server.getWorker().getEnv();
    await DB.prepare('DELETE FROM signups').run();
  });

  await t.test('stores a valid sign-up with consent timestamp, source and notice version', async () => {
    const before = Date.now();
    const response = await signUp(server, { email: '  Reader@Example.COM ' });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).status, 'created');
    const rows = await rowsOf(server);
    assert.equal(rows.length, 1);
    const [row] = rows;
    assert.equal(row.email, 'reader@example.com');
    assert.equal(row.source, 'lozza');
    assert.equal(row.privacy_notice_version, '2026-11-09');
    const consented = Date.parse(row.consented_at);
    assert.ok(consented >= before - 1000 && consented <= Date.now() + 1000, `consented_at ${row.consented_at}`);
  });

  await t.test('a duplicate returns "already on the list" and stores no new row', async () => {
    assert.equal((await signUp(server)).status, 201);
    const response = await signUp(server, { email: 'READER@example.com' });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'already-signed-up');
    assert.match(body.message, /already on the list/i);
    assert.equal((await rowsOf(server)).length, 1);
  });

  const assertRejected = async (response, status, reason, message) => {
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.status, 'rejected');
    assert.equal(body.reason, reason);
    assert.match(body.message, message);
    assert.deepEqual(await rowsOf(server), []);
  };

  await t.test('malformed addresses are rejected with a clear message', async () => {
    for (const email of ['', 'reader', 'reader@', '@example.com', 'reader@example', 'rea der@example.com', 'reader@@example.com', `${'a'.repeat(65)}@example.com`]) {
      await assertRejected(await signUp(server, { email }), 400, 'invalid-email', /valid email address/i);
    }
  });

  await t.test('disposable addresses are rejected with a clear message', async () => {
    for (const email of ['someone@mailinator.com', 'Someone@YOPMAIL.com', 'someone@inbox.mailinator.com']) {
      await assertRejected(await signUp(server, { email }), 400, 'disposable-email', /disposable/i);
    }
  });

  await t.test('a sign-up without consent is rejected', async () => {
    await assertRejected(await signUp(server, { consent: '' }), 400, 'consent-required', /consent/i);
  });

  await t.test('a sign-up for an unknown list is rejected', async () => {
    await assertRejected(await signUp(server, { source: 'newsletter' }), 400, 'unknown-source', /list/i);
  });

  await t.test('a missing Turnstile token is rejected', async () => {
    await assertRejected(await signUp(server, { 'cf-turnstile-response': '' }), 403, 'bot-check-failed', /bot check/i);
  });

  await t.test('non-POST requests are rejected', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await server.fetch(ENDPOINT, { method, headers: { Origin: ORIGIN } });
      assert.equal(response.status, 405, method);
      assert.equal(response.headers.get('Allow'), 'POST');
      assert.equal((await response.json()).status, 'rejected');
    }
  });

  await t.test('foreign-origin requests are rejected', async () => {
    await assertRejected(await signUp(server, {}, { headers: { Origin: 'https://evil.example' } }), 403, 'forbidden-origin', /origin/i);
    await assertRejected(await signUp(server, {}, { headers: {} }), 403, 'forbidden-origin', /origin/i);
  });

  await t.test('nothing else under /api/ answers', async () => {
    const response = await server.fetch(`${ORIGIN}/api/signups`, { headers: { Origin: ORIGIN } });
    assert.equal(response.status, 404);
  });
});

test('the Waitlist Worker rejects an invalid Turnstile token', async (t) => {
  const server = harness(FAILS);
  t.after(() => server.close());
  await server.listen();
  await server.getWorker().applyD1Migrations('DB');
  const response = await signUp(server);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.reason, 'bot-check-failed');
  assert.match(body.message, /bot check/i);
  assert.deepEqual(await rowsOf(server), []);
});
