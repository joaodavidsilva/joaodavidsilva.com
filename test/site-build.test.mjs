import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture, buildFixtureWithHistory } from './build.mjs';

const canonical = 'https://joaodavidsilva.com/hello/';

test('a page is published under the agent-readability contract', async (t) => {
  // "Last updated" comes from git history: the page was last committed on 4 March.
  const site = buildFixtureWithHistory('basic', [{ date: '2026-03-04T12:00:00Z' }]);
  assert.ok(site.ok, site.output);
  const html = site.read('hello/index.html');

  await t.test('HTML carries the complete content without JavaScript', () => {
    assert.match(html, /<h1>Hello fixture<\/h1>/);
    assert.match(html, /The fixture body paragraph\./);
    assert.doesNotMatch(html, /<script(?![^>]*(?:application\/ld\+json|data-theme-script))/);
  });

  await t.test('HTML advertises the Markdown twin', () => {
    assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/hello\.md">/);
  });

  await t.test('JSON-LD carries the metadata', () => {
    const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
    const ld = JSON.parse(json);
    assert.equal(ld.headline, 'Hello fixture');
    assert.equal(ld.description, 'A one-line summary of the fixture page.');
    assert.equal(ld.datePublished, '2026-01-02');
    assert.equal(ld.dateModified, '2026-03-04');
    assert.equal(ld.inLanguage, 'en');
    assert.deepEqual(ld.keywords, ['testing', 'agents']);
    assert.equal(ld.url, canonical);
  });

  await t.test('Markdown twin has front-matter and body', () => {
    const md = site.read('hello.md');
    assert.ok(md.startsWith('---\n'));
    for (const line of [
      'title: "Hello fixture"',
      'summary: "A one-line summary of the fixture page."',
      'published: 2026-01-02',
      'updated: 2026-03-04',
      'language: en',
      'tags: ["testing", "agents"]',
      `canonical: ${canonical}`,
    ]) assert.ok(md.includes(`\n${line}\n`), `missing ${line}`);
    assert.match(md, /The fixture body paragraph\./);
  });

  await t.test('llms.txt lists the page with its summary', () => {
    assert.match(
      site.read('llms.txt'),
      /- \[Hello fixture\]\(https:\/\/joaodavidsilva\.com\/hello\.md\): A one-line summary of the fixture page\./,
    );
  });
});

test('missing front-matter fails naming the file and field', () => {
  const site = buildFixture('missing-title');
  assert.equal(site.ok, false);
  assert.match(site.output, /broken\.md/);
  assert.match(site.output, /title/);
});

test('invalid front-matter fails naming the file and field', () => {
  const site = buildFixture('invalid-date');
  assert.equal(site.ok, false);
  assert.match(site.output, /bad-date\.md/);
  assert.match(site.output, /published/);
});

test('a page claiming a reserved path fails the build', () => {
  const site = buildFixture('reserved-path');
  assert.equal(site.ok, false);
  assert.match(site.output, /dotore\.md: path "\/dotore\/" is reserved/);
});

test('an unknown page front-matter field fails the build', () => {
  const site = buildFixture('page-unknown-field');
  assert.equal(site.ok, false);
  assert.match(site.output, /hello\.md/);
  assert.match(site.output, /updated/);
});
