import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(
  join(root, '.scratch/milestone-0/facts-memorizer-privacy-policy-2026-08-19.md'),
  'utf8',
);

/** The policy's sections, keyed by heading, from the line after `---`. */
function sections(md) {
  const out = {};
  let current = 'intro';
  for (const line of md.split('\n')) {
    const h = line.match(/^## (.+)$/);
    if (h) current = h[1];
    else (out[current] ??= []).push(line);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join('\n').trim()]));
}

const original = sections(source.split('\n---\n')[1]);

test('the Facts Memorizer privacy policy is published', async (t) => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const html = site.read('projects/facts-memorizer/privacy/index.html');
  const md = site.read('projects/facts-memorizer/privacy.md');
  const current = sections(md.split(/^---$/m).slice(2).join('---'));

  await t.test('at its permanent URL with twin and JSON-LD', () => {
    assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/projects\/facts-memorizer\/privacy\.md">/);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(ld.url, 'https://joaodavidsilva.com/projects/facts-memorizer/privacy/');
  });

  await t.test('with Contact and the adjusted links section', () => {
    assert.match(current['Contact'], /João David Silva/);
    assert.match(current['Contact'], /privacy@joaodavidsilva\.com/);
    assert.match(current['Links that open outside the app'], /\]\(\/privacy\/\)/);
    assert.notEqual(current['Links that open outside the app'], original['Links that open outside the app']);
  });

  await t.test('with every other section unchanged', () => {
    for (const [heading, body] of Object.entries(original)) {
      if (heading === 'intro' || heading === 'Links that open outside the app') continue;
      assert.equal(current[heading], body, heading);
    }
    assert.ok(current.intro.includes(original.intro.replace(/^Effective date: .*\n\n/, '')));
  });

  await t.test('with a new effective date and the previous version linked', () => {
    assert.match(md, /Effective date: 9 November 2026/);
    assert.match(md, /\(\/projects\/facts-memorizer\/privacy\/2026-08-19\/\)/);
  });

  await t.test('keeping the previous version verbatim', () => {
    const prev = site.read('projects/facts-memorizer/privacy/2026-08-19.md');
    const old = sections(prev.split(/^---$/m).slice(2).join('---'));
    for (const [heading, body] of Object.entries(original)) {
      if (heading === 'intro') assert.ok(old.intro.includes(body));
      else assert.equal(old[heading], body, heading);
    }
    assert.match(prev, /\(\/projects\/facts-memorizer\/privacy\/\)/);
  });
});
