import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from './build.mjs';

test('the Facts Memorizer terms are published', async (t) => {
  const site = buildSite();
  assert.ok(site.ok, site.output);

  await t.test('at their permanent URL under the agent-readability contract', () => {
    assert.ok(site.has('projects/facts-memorizer/terms/index.html'));
    assert.ok(site.has('projects/facts-memorizer/terms.md'));
    assert.match(site.read('projects/facts-memorizer/terms/index.html'), /application\/ld\+json/);
  });

  await t.test('with an effective date', () => {
    assert.match(site.read('projects/facts-memorizer/terms.md'), /Effective date: \d{1,2} \w+ \d{4}/);
  });

  await t.test('consistent with the privacy policy: free, no accounts, no ads, no data collection, for children', () => {
    const md = site.read('projects/facts-memorizer/terms.md');
    assert.match(md, /free/i);
    assert.match(md, /no accounts?/i);
    assert.match(md, /no ads|no advertising/i);
    assert.match(md, /collects no personal data/i);
    assert.match(md, /children/i);
    assert.match(md, /\/projects\/facts-memorizer\/privacy\//);
    assert.match(md, /no in-app purchases/i);
    assert.doesNotMatch(md, /we (may )?collect|create an account/i);
  });
});
