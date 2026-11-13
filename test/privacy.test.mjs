import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './build.mjs';

test('the site privacy notice is published', async (t) => {
  const site = buildSite();
  assert.ok(site.ok, site.output);

  await t.test('under the agent-readability contract', () => {
    assert.ok(site.has('privacy/index.html'));
    assert.ok(site.has('privacy.md'));
    assert.match(site.read('llms.txt'), /\(https:\/\/joaodavidsilva\.com\/privacy\.md\)/);
    const html = site.read('privacy/index.html');
    assert.match(html, /<article class="container index-page prose">/);
    assert.match(html, /<h1 class="page-title">/);
    assert.match(html, /<p class="lede">/);
  });

  await t.test('names cookie-free Cloudflare analytics, hosting and contact', () => {
    const md = site.read('privacy.md');
    assert.match(md, /Cloudflare Web Analytics/);
    assert.match(md, /cookie/i);
    assert.match(md, /privacy@joaodavidsilva\.com/);
  });

  await t.test('names the theme choice kept in local storage', () => {
    const md = site.read('privacy.md');
    assert.doesNotMatch(md, /stores nothing on your device/);
    assert.match(md, /theme[^.]*local storage|local storage[^.]*theme/i);
  });

  await t.test('has no retired Lozza Waitlist or Turnstile section', () => {
    const md = site.read('privacy.md');
    assert.doesNotMatch(md, /Waitlist|Turnstile|projects\/lozza|turnstile-privacy-policy/i);
  });
});

test('the site sets no cookies', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const files = readdirSync(root, { recursive: true }).filter((f) => /\.(astro|ts|mjs|js)$/.test(f));
  for (const f of files) {
    const src = readFileSync(join(root, f), 'utf8');
    assert.doesNotMatch(src, /document\.cookie|Set-Cookie|cookies\.set/i, f);
  }
});
