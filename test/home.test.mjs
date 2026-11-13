import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent, buildFixture } from './build.mjs';
import { stylesheetsOf } from './css.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const textOf = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const sectionOf = (html, id) => html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>(.*?)</section>`, 's'))?.[1];
const hrefsIn = (fragment) => [...fragment.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map(([, href]) => href);

const site = buildFixture('home');

test('the home fixture builds', () => assert.ok(site.ok, site.output));

test('home hero uses authored copy and record-derived facts, with only Contact and PDF actions', () => {
  const html = site.read('index.html');
  const hero = sectionOf(html, 'home-hero');
  assert.match(textOf(hero), /Lead AI Engineer · Lisbon, Portugal · remote within the EU/);
  assert.match(hero, /<h1[^>]*>Engineering <em>beyond<\/em> implementation\.<\/h1>/);
  assert.match(textOf(hero), /The fixture introduction\./);
  assert.match(textOf(hero), /Now AI Mobile Developer at EDP, building Mind4EDP Mobile/);
  assert.match(textOf(hero), /Led A cross-functional team at Reflaunt, 2022–23/);
  assert.match(textOf(hero), /Stack React Native, TypeScript, Python/);
  assert.deepEqual(hrefsIn(hero), ['mailto:me@joaodavidsilva.com', '/cv.pdf', '/now/']);
  assert.doesNotMatch(html, /DOCX|cv\.docx/i);
});

test('How I work is a dark band with the authored four-step method and real links', () => {
  const band = sectionOf(site.read('index.html'), 'how-i-work');
  assert.match(band, /class="[^"]*band/);
  assert.match(textOf(band), /01 \/ How I work/);
  assert.equal((band.match(/<li>/g) ?? []).length, 4);
  assert.match(textOf(band), /Grill before building.*Write the language down.*Spec, then tickets.*Implement, then look back/);
  assert.deepEqual(hrefsIn(band), ['/projects/ai-skills/', '/writing/a6/']);
});

test('In practice uses corrected EDP facts and derives its two stats from the record', () => {
  const practice = sectionOf(site.read('index.html'), 'in-practice');
  const text = textOf(practice);
  assert.match(text, /lead architect of Mind4EDP Mobile/);
  assert.match(text, /built with a team/);
  assert.doesNotMatch(text, /sole developer|mobile client is mine/i);
  assert.match(practice, /<dd>13,000\+<\/dd>\s*<dt>active EDP colleagues · attested<\/dt>/);
  assert.match(practice, /<dd>3<\/dd>\s*<dt>languages: Portuguese, English, Spanish<\/dt>/);
  assert.doesNotMatch(practice, /source:\s*LinkedIn/i);
});

test('Writing features only the latest Article with computed date, reading time and summary', () => {
  const writing = sectionOf(site.read('index.html'), 'writing');
  assert.deepEqual(hrefsIn(writing), ['/writing/a6/', '/writing/a6/', '/research/']);
  assert.match(textOf(writing), /Article · 5 June 2026 · 1 min read/);
  assert.match(textOf(writing), /Article a6/);
  assert.match(textOf(writing), /Summary of a6\./);
  assert.doesNotMatch(textOf(writing), /Article a4|Study s/);
});

test('Projects use the deliberate mockup order, real versions and an unlinked Lozza own-site card', () => {
  const projects = sectionOf(site.read('index.html'), 'projects');
  const names = [...projects.matchAll(/<h3>(?:<a[^>]*>)?([^<]+)/g)].map((match) => match[1]);
  assert.deepEqual(names, ['AI Skills', 'BrightBoi', 'dotore', 'Facts Memorizer', 'Lozza', 'Markdown Exporter']);
  assert.match(textOf(projects), /Active · v1\.2\.0/);
  assert.match(textOf(projects), /In development · own site/);
  assert.match(textOf(projects), /Native design tool for Mac and iPad/);
  const lozza = projects.match(/<li[^>]*>(?:(?!<\/li>)[^])*Lozza(?:(?!<\/li>)[^])*<\/li>/s)?.[0];
  assert.ok(lozza);
  assert.equal(hrefsIn(lozza).length, 0);
});

test('Knowledge cards derive counts and titles from content', () => {
  const knowledge = sectionOf(site.read('index.html'), 'knowledge');
  assert.match(textOf(knowledge), /2 entries AI Engineering Agent · Model/);
  assert.match(textOf(knowledge), /1 entry Context Engineering Context/);
  assert.equal((knowledge.match(/<li>/g) ?? []).length, 2);
});

test('the contact strip has email, LinkedIn, GitHub and PDF only', () => {
  const contact = sectionOf(site.read('index.html'), 'contact');
  assert.deepEqual(hrefsIn(contact), [
    'mailto:me@joaodavidsilva.com',
    'https://www.linkedin.com/in/joaodavidsilvaa/',
    'https://github.com/joaodavidsilva',
    '/cv.pdf',
  ]);
  assert.doesNotMatch(contact, /DOCX|cv\.docx/i);
});

test('the home page has no dated-document chrome or correction link', () => {
  const main = site.read('index.html').match(/<main\b[^>]*>(.*)<\/main>/s)[1];
  assert.doesNotMatch(textOf(main), /Published/);
  assert.doesNotMatch(main, /Suggest a correction/);
  assert.doesNotMatch(main, /<h1 class="sr-only">/);
});

test('Now is published at /now/ with a dated labelled-row layout and a Markdown twin', () => {
  const html = site.read('now/index.html');
  assert.match(textOf(html), /What I am working on now\./);
  assert.match(textOf(html), /Last said on 1 October 2026/);
  assert.match(html, /<dt class="row-label">Working on<\/dt>\s*<dd>Writing the fixture now block\.<\/dd>/);
  assert.match(html, /<dt class="row-label">Building<\/dt>\s*<dd><a href="\/projects\/live\/">Live App<\/a>\.<\/dd>/);
  assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/now\.md"/);
  const md = site.read('now.md');
  assert.match(md, /^---\n[^]*\nupdated: 2026-10-01\n[^]*canonical: https:\/\/joaodavidsilva\.com\/now\/\n---\n/);
  assert.ok(md.includes('\npublished: 2026-10-01\n'), md);
  assert.ok(md.includes('\ntags: []\n'), md);
  assert.match(md, /Writing the fixture now block\./);
  assert.match(site.read('llms.txt'), /\[Now\]\(https:\/\/joaodavidsilva\.com\/now\.md\)/);
});

test('the home twin carries the authored sections and all dynamic equivalents', () => {
  const md = site.read('index.md');
  for (const heading of ['# Engineering *beyond* implementation.', '## How I work', '## In practice', '## Writing', '## Projects', '## Knowledge', '## Contact']) {
    assert.ok(md.includes(heading), heading);
  }
  assert.match(md, /\[Article a6\]\(https:\/\/joaodavidsilva\.com\/writing\/a6\.md\)/);
  assert.match(md, /\[AI Skills\]\(https:\/\/joaodavidsilva\.com\/projects\/ai-skills\.md\)/);
  assert.match(md, /Native design tool for Mac and iPad/);
  assert.match(md, /2 entries/);
  assert.doesNotMatch(md, /DOCX|cv\.docx/i);
});

test('publishing a new Article updates the Home feature without editing the home page', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jds-home-new-'));
  cpSync(join(root, 'test', 'fixtures', 'home'), dir, { recursive: true });
  writeFileSync(join(dir, 'articles', 'fresh.md'), '---\ntitle: Fresh\nsummary: Brand new.\npublished: 2026-09-01\n---\n\nNew.\n');
  const updated = buildContent('home-new', dir);
  assert.ok(updated.ok, updated.output);
  assert.equal(hrefsIn(sectionOf(updated.read('index.html'), 'writing'))[0], '/writing/fresh/');
});

test('Home and Now add no page scripts and retain their Markdown alternate links', () => {
  for (const [file, twin] of [['index.html', '/index.md'], ['now/index.html', '/now.md']]) {
    const html = site.read(file);
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((match) => match[1]);
    assert.ok(scripts.every((attributes) => /data-theme-script|data-menu-script|type="application\/ld\+json"/.test(attributes)));
    assert.ok(html.includes(`<link rel="alternate" type="text/markdown" href="${twin}"`));
  }
});

test('Home and Now keep semantic heading/definition structure', () => {
  const home = site.read('index.html');
  assert.equal((home.match(/<h1\b/g) ?? []).length, 1);
  assert.match(home, /<dl class="facts home-facts">/);
  assert.match(home, /<ol class="steps">/);
  assert.match(home, /<dl class="stats">/);
  const now = site.read('now/index.html');
  assert.equal((now.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((now.match(/<dt\b/g) ?? []).length, 3);
  assert.equal((now.match(/<dd\b/g) ?? []).length, 3);
});

test('built Home and Now CSS includes narrow-screen reflow and overflow protection', () => {
  const css = ['index.html', 'now/index.html'].map((path) => stylesheetsOf(site, site.read(path))).join('\n');
  assert.match(css, /@media \(width<=640px\)/);
  assert.match(css, /\.now-rows dt\{flex-basis:100%/);
  assert.match(css, /\.home-email\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.knowledge-cards\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('without a Now entry Home omits its Now fact and does not publish the route', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jds-home-no-now-'));
  cpSync(join(root, 'test', 'fixtures', 'home'), dir, { recursive: true });
  rmSync(join(dir, 'now.md'));
  const withoutNow = buildContent('home-no-now', dir);
  assert.ok(withoutNow.ok, withoutNow.output);
  assert.ok(!withoutNow.has('now/index.html'));
  assert.ok(!withoutNow.has('now.md'));
  assert.doesNotMatch(sectionOf(withoutNow.read('index.html'), 'home-hero'), /<dt>Now<\/dt>/);
});

test('without a Now entry or optional collections the generic pages and Home still build', () => {
  const basic = buildFixture('basic');
  assert.ok(basic.ok, basic.output);
  assert.ok(!basic.has('now/index.html'));
  assert.ok(!basic.has('now.md'));
  assert.match(textOf(basic.read('hello/index.html')), /Hello/);
});
