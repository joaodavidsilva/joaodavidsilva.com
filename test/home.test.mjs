import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent, buildFixture } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const sectionOf = (html, id) => html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>(.*?)</section>`, 's'))?.[1];
const hrefsIn = (fragment) => [...fragment.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map(([, href]) => href);

const site = buildFixture('home');

test('the home fixture builds', () => assert.ok(site.ok, site.output));

test('home shows the introduction and positioning', () => {
  const text = textOf(site.read('index.html'));
  assert.match(text, /Engineering beyond implementation/);
  assert.match(text, /The fixture introduction\./);
});

test('Featured shows only featured items, newest first, at most 3', () => {
  const featured = sectionOf(site.read('index.html'), 'featured');
  assert.deepEqual(hrefsIn(featured), ['/writing/a6/', '/writing/a4/', '/writing/a2/']);
});

test('Recent shows the newest Articles and Studies not shown in Featured, at most 5, with type, written-out date and summary', () => {
  const recent = sectionOf(site.read('index.html'), 'recent');
  // a6, a4 and a2 are in Featured; a1 and s2 are featured too but did not fit there.
  assert.deepEqual(hrefsIn(recent), ['/writing/a5/', '/research/s1/', '/writing/a3/', '/research/s2/', '/writing/a1/']);
  const text = textOf(recent);
  assert.match(text, /Study.*20 April 2026.*Summary of s1\./);
  assert.match(recent, /<time datetime="2026-04-20">20 April 2026<\/time>/);
  assert.match(text, /Article.*5 May 2026.*Summary of a5\./);
});

test('Featured and Recent titles are headings, the meta line below them', () => {
  const featured = sectionOf(site.read('index.html'), 'featured');
  assert.match(featured, /<h3><a href="\/writing\/a6\/">Article a6<\/a><\/h3>\s*<p class="piece-meta">/);
});

test('the home page is not a dated document: no Published line, no correction link, no repeated name as a visible title', () => {
  const main = site.read('index.html').match(/<main\b[^>]*>(.*)<\/main>/s)[1];
  const header = main.match(/<header\b[^>]*>(.*?)<\/header>/s)[1];
  assert.doesNotMatch(textOf(header), /Published/);
  assert.doesNotMatch(main, /Suggest a correction/);
  assert.match(header, /<h1 class="sr-only">/);
});

test('Active projects shows only active Projects with their latest version', () => {
  const projects = sectionOf(site.read('index.html'), 'projects');
  assert.deepEqual(hrefsIn(projects), ['/projects/live/']);
  assert.match(textOf(projects), /Live App .*2\.1\.0/);
});

test('Now shows its date on the home page and links to /now/', () => {
  const now = sectionOf(site.read('index.html'), 'now');
  assert.match(now, /<time datetime="2026-10-01"[ >]/);
  assert.match(textOf(now), /Writing the fixture now block\./);
  assert.ok(hrefsIn(now).includes('/now/'));
});

test('Now is published at /now/ with a Markdown twin', () => {
  const html = site.read('now/index.html');
  assert.match(html, /<time datetime="2026-10-01"[ >]/);
  assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/now\.md"/);
  const md = site.read('now.md');
  assert.match(md, /^---\n[^]*\nupdated: 2026-10-01\n[^]*canonical: https:\/\/joaodavidsilva\.com\/now\/\n---\n/);
  assert.ok(md.includes('\npublished: 2026-10-01\n'), md);
  assert.ok(md.includes('\ntags: []\n'), md);
  assert.match(md, /Writing the fixture now block\./);
  assert.match(site.read('llms.txt'), /\[Now\]\(https:\/\/joaodavidsilva\.com\/now\.md\)/);
});

test('the home twin carries Now, Featured, Recent and Active projects', () => {
  const md = site.read('index.md');
  for (const heading of ['## Now', '## Featured', '## Recent', '## Active projects']) assert.ok(md.includes(heading), heading);
  assert.match(md, /\[Article a6\]\(https:\/\/joaodavidsilva\.com\/writing\/a6\.md\)/);
  assert.match(md, /\[Live App\]\(https:\/\/joaodavidsilva\.com\/projects\/live\.md\): An active app\. \(version 2\.1\.0\)/);
});

test('publishing a new Article updates Recent without editing the home page', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jds-home-new-'));
  cpSync(join(root, 'test', 'fixtures', 'home'), dir, { recursive: true });
  writeFileSync(join(dir, 'articles', 'fresh.md'), '---\ntitle: Fresh\nsummary: Brand new.\npublished: 2026-09-01\n---\n\nNew.\n');
  const updated = buildContent('home-new', dir);
  assert.ok(updated.ok, updated.output);
  assert.equal(hrefsIn(sectionOf(updated.read('index.html'), 'recent'))[0], '/writing/fresh/');
});

test('without a Now entry there is no Now block and no /now/', () => {
  const basic = buildFixture('basic');
  assert.ok(basic.ok, basic.output);
  assert.ok(!basic.has('now/index.html'));
  assert.ok(!basic.has('now.md'));
});
