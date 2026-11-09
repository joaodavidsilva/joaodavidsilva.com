import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent, buildFixture } from './build.mjs';

// Every page type with a Portuguese Translation: the ADR-0005 contract beyond `pages`.
const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'translated-site');
const SITE = 'https://joaodavidsilva.com';

/** `<link rel="alternate" hreflang>` tags as [hreflang, href], sorted. */
const hreflangsOf = (html) =>
  [...html.matchAll(/<link\b[^>]*\bhreflang="([^"]+)"[^>]*>/g)].map(([tag, lang]) => [lang, tag.match(/href="([^"]+)"/)[1]]).sort();

/** The language switcher's links as [hreflang, href]. */
function switcherOf(html) {
  const nav = html.match(/<nav\b[^>]*class="language-switcher"[^>]*>(.*?)<\/nav>/s);
  return nav && [...nav[1].matchAll(/<a\b([^>]*)>/g)].map(([, attrs]) => [attrs.match(/hreflang="([^"]+)"/)[1], attrs.match(/href="([^"]+)"/)[1]]);
}

const mainOf = (html) => html.match(/<main\b[^>]*>(.*)<\/main>/s)[1];
const hrefsIn = (html) => [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
const sectionOf = (html, id) => html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>(.*?)</section>`, 's'))?.[1] ?? '';
const OUTDATED = /class="translation-note outdated"/;

/** Each page type: its English path, its Portuguese path and whether it is a Translation of a file (not a generated index). */
const PAGE_TYPES = [
  ['Home', '/', '/pt/', true],
  ['Article', '/writing/a1/', '/pt/writing/a1/', true],
  ['Series', '/writing/series/doghouse/', '/pt/writing/series/doghouse/', true],
  ['Study', '/research/s1/', '/pt/research/s1/', true],
  ['Knowledge entry', '/knowledge/k1/', '/pt/knowledge/k1/', true],
  ['Project', '/projects/p1/', '/pt/projects/p1/', true],
  ['Now', '/now/', '/pt/now/', true],
  ['About', '/about/', '/pt/about/', true],
  ['Writing index', '/writing/', '/pt/writing/', false],
  ['Research index', '/research/', '/pt/research/', false],
  ['Knowledge index', '/knowledge/', '/pt/knowledge/', false],
  ['Projects index', '/projects/', '/pt/projects/', false],
];

const fileOf = (path) => `${path.slice(1)}index.html`;
const twinOf = (path) => (path === '/' ? '/index.md' : `${path.slice(0, -1)}.md`);

test('every page type has a Portuguese Translation', async (t) => {
  const site = buildFixture('translated-site');
  assert.ok(site.ok, site.output);

  for (const [type, en, pt, translated] of PAGE_TYPES) {
    await t.test(`${type}: renders at ${pt} in Portuguese with its own twin, hreflang both ways and the switcher`, () => {
      const html = site.read(fileOf(pt));
      const original = site.read(fileOf(en));
      assert.match(html, /<html lang="pt">/);
      assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}${pt}">`));
      const expected = [['en', `${SITE}${en}`], ['pt', `${SITE}${pt}`], ['x-default', `${SITE}${en}`]];
      assert.deepEqual(hreflangsOf(html), expected);
      assert.deepEqual(hreflangsOf(original), expected);
      assert.deepEqual(switcherOf(html), [['en', en], ['pt', pt]]);
      assert.deepEqual(switcherOf(original), [['en', en], ['pt', pt]]);
      const twinPath = pt === '/pt/' ? '/pt/index.md' : twinOf(pt);
      assert.match(html, new RegExp(`<link rel="alternate" type="text/markdown" href="${twinPath}">`));
      const twin = site.read(twinPath.slice(1));
      assert.ok(twin.includes('\nlanguage: pt\n'), `${twinPath}: language`);
      assert.ok(twin.includes(`\ncanonical: ${SITE}${pt}\n`), `${twinPath}: canonical`);
      if (translated) {
        assert.ok(twin.includes(`\noriginal: ${SITE}${en}\noutdated: false\n`), `${twinPath}: original`);
        assert.doesNotMatch(html, OUTDATED);
      }
    });
  }

  await t.test('Translations carry their translated text', () => {
    assert.match(site.read('pt/index.html'), /A introdução de teste\./);
    assert.match(site.read('pt/writing/a1/index.html'), /<h1>Artigo um<\/h1>/);
    assert.match(site.read('pt/writing/series/doghouse/index.html'), /A introdução da casota\./);
    assert.match(site.read('pt/research/s1/index.html'), /As conclusões\./);
    assert.match(site.read('pt/knowledge/k1/index.html'), /O corpo do primeiro conceito\./);
    assert.match(site.read('pt/projects/p1/index.html'), /<h1>Projeto um<\/h1>/);
    assert.match(site.read('pt/now/index.html'), /A escrever o bloco de agora\./);
    assert.match(site.read('pt/about/index.html'), /Engenharia para lá da implementação\./);
  });

  await t.test('a page without a Translation offers no switcher and no Portuguese hreflang', () => {
    for (const path of ['/writing/a2/', '/knowledge/k2/', '/projects/p2/']) {
      const html = site.read(fileOf(path));
      assert.equal(switcherOf(html), null, path);
      assert.deepEqual(hreflangsOf(html), [], path);
    }
    assert.ok(!site.has('pt/writing/a2/index.html'));
  });

  await t.test('Portuguese indexes list only Portuguese Translations', () => {
    const writing = hrefsIn(mainOf(site.read('pt/writing/index.html')));
    assert.deepEqual(writing.filter((h) => h.startsWith('/pt/writing/') && h !== '/pt/writing/'), ['/pt/writing/a1/', '/pt/writing/series/doghouse/']);
    assert.ok(!writing.includes('/writing/a2/'));
    assert.ok(hrefsIn(mainOf(site.read('pt/research/index.html'))).includes('/pt/research/s1/'));
    const knowledge = hrefsIn(mainOf(site.read('pt/knowledge/index.html')));
    assert.ok(knowledge.includes('/pt/knowledge/k1/'));
    assert.ok(!knowledge.some((h) => h.includes('k2')), knowledge.join(' '));
    const projects = hrefsIn(mainOf(site.read('pt/projects/index.html')));
    assert.ok(projects.includes('/pt/projects/p1/'));
    assert.ok(!projects.some((h) => h.includes('p2')));
    assert.match(site.read('pt/writing.md'), /\[Artigo um\]\(https:\/\/joaodavidsilva\.com\/pt\/writing\/a1\.md\)/);
    assert.doesNotMatch(site.read('pt/writing.md'), /Article two/);
  });

  await t.test('Portuguese tag pages list the Portuguese entries by their own tags', () => {
    assert.ok(hrefsIn(mainOf(site.read('pt/knowledge/index.html'))).includes('/pt/knowledge/tags/fichas/'));
    assert.ok(hrefsIn(mainOf(site.read('pt/knowledge/tags/fichas/index.html'))).includes('/pt/knowledge/k1/'));
    assert.ok(site.has('pt/knowledge/tags/fichas.md'));
    assert.ok(!site.has('pt/knowledge/tags/tokens/index.html'));
  });

  await t.test('related entries and "Discussed in" stay in the page language', () => {
    assert.doesNotMatch(mainOf(site.read('pt/knowledge/k1/index.html')), /href="\/(pt\/)?knowledge\/k2\/"/);
    assert.match(mainOf(site.read('knowledge/k1/index.html')), /href="\/knowledge\/k2\/"/);
    assert.ok(hrefsIn(sectionOf(site.read('pt/research/s1/index.html'), 'discussed-in')).includes('/pt/writing/a1/'));
    assert.ok(hrefsIn(sectionOf(site.read('research/s1/index.html'), 'discussed-in')).includes('/writing/a1/'));
  });

  await t.test('Series parts link the Portuguese part where it exists and the English Original otherwise', () => {
    const series = mainOf(site.read('pt/writing/series/doghouse/index.html'));
    assert.ok(hrefsIn(series).includes('/pt/writing/a1/'));
    assert.match(series, /<a href="\/writing\/a2\/" hreflang="en"/);
    const part = mainOf(site.read('pt/writing/a1/index.html'));
    assert.ok(hrefsIn(part).includes('/pt/writing/series/doghouse/'));
    assert.match(part, /<a href="\/writing\/a2\/" hreflang="en"[^>]*rel="next"/);
  });

  await t.test('a Portuguese Project links its legal documents in Portuguese where translated', () => {
    const legal = hrefsIn(mainOf(site.read('pt/projects/p1/index.html')));
    assert.ok(legal.includes('/pt/projects/p1/privacy/'));
    assert.ok(legal.includes('/projects/p1/terms/'));
  });

  await t.test('the Portuguese home lists Portuguese pieces, Projects and Now', () => {
    const home = site.read('pt/index.html');
    assert.deepEqual(hrefsIn(sectionOf(home, 'recent')), ['/pt/writing/a1/', '/pt/research/s1/']);
    assert.deepEqual(hrefsIn(sectionOf(home, 'featured')), ['/pt/writing/a1/']);
    assert.deepEqual(hrefsIn(sectionOf(home, 'projects')), ['/pt/projects/p1/']);
    assert.ok(hrefsIn(sectionOf(home, 'now')).includes('/pt/now/'));
    assert.match(site.read('pt/index.md'), /\[Artigo um\]\(https:\/\/joaodavidsilva\.com\/pt\/writing\/a1\.md\)/);
    assert.deepEqual(hrefsIn(sectionOf(site.read('index.html'), 'recent')), ['/writing/a2/', '/writing/a1/', '/research/s1/']);
  });

  await t.test('the Portuguese feed carries Portuguese Articles and Studies', () => {
    const feed = site.read('pt/feed.xml');
    assert.match(feed, /xml:lang="pt"/);
    assert.ok(feed.includes(`<id>${SITE}/pt/writing/a1/</id>`));
    assert.ok(feed.includes(`<id>${SITE}/pt/research/s1/</id>`));
    assert.ok(!feed.includes('/writing/a2/'));
    assert.match(site.read('pt/index.html'), /<link rel="alternate" type="application\/atom\+xml"[^>]*href="\/pt\/feed\.xml"/);
  });

  await t.test('the header and footer speak Portuguese on Portuguese pages', () => {
    const html = site.read('pt/writing/a1/index.html');
    const header = html.match(/<header class="site-header">(.*?)<\/header>/s)[1];
    assert.match(header, /<a href="\/pt\/writing\/"[^>]*>Escrita<\/a>/);
    assert.match(header, /<a href="\/pt\/research\/"[^>]*>Investigação<\/a>/);
    assert.match(header, /<a href="\/pt\/knowledge\/"[^>]*>Conhecimento<\/a>/);
    assert.match(header, /<a href="\/pt\/projects\/"[^>]*>Projetos<\/a>/);
    assert.match(header, /<a href="\/pt\/about\/"[^>]*>Sobre<\/a>/);
    assert.match(header, /class="site-name" href="\/pt\/"/);
    const footer = html.match(/<footer class="site-footer">(.*?)<\/footer>/s)[1];
    assert.match(footer, /<legend>Tema<\/legend>/);
    assert.match(footer, /Conteúdo licenciado/);
    assert.match(footer, /href="\/pt\/feed\.xml"/);
    assert.match(site.read('writing/a1/index.html'), /<a href="\/writing\/"[^>]*>Writing<\/a>/);
  });

  await t.test('llms.txt points every Original to its Portuguese Translation', () => {
    const llms = site.read('llms.txt');
    for (const [, en, pt] of PAGE_TYPES) {
      const twin = (path) => `${SITE}${path === '/' ? '/index.md' : twinOf(path)}`;
      const line = llms.split('\n').find((l) => l.includes(`](${twin(en)})`));
      assert.ok(line, `llms.txt lists ${en}`);
      assert.ok(line.includes(`[Português](${pt === '/pt/' ? `${SITE}/pt/index.md` : twin(pt)})`), line);
    }
    assert.doesNotMatch(llms, /\]\(https:\/\/joaodavidsilva\.com\/pt\/[^)]*\):/, 'Translations are not listed as Originals');
  });

  await t.test('no Portuguese page links to a page the build did not produce', () => {
    const missing = [];
    const walk = (dir) => {
      for (const name of readdirSync(join(site.dir, dir))) {
        const rel = join(dir, name);
        if (statSync(join(site.dir, rel)).isDirectory()) walk(rel);
        else if (name === 'index.html') {
          for (const href of hrefsIn(site.read(rel))) {
            if (!href.startsWith('/') || href.startsWith('//')) continue;
            const path = href.split('#')[0];
            if (!site.has(path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1))) missing.push(`${rel} → ${href}`);
          }
        }
      }
    };
    walk('pt');
    assert.deepEqual(missing, []);
  });
});

test('editing each Original makes its Portuguese Translation outdated', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jds-translated-site-outdated-'));
  cpSync(fixture, dir, { recursive: true });
  for (const file of ['pages/index.md', 'articles/a1.md', 'series/doghouse.md', 'studies/s1.md', 'knowledge/k1.md', 'projects/p1.md', 'now.md']) {
    appendFileSync(join(dir, file), '\nA new paragraph.\n');
  }
  appendFileSync(join(dir, 'record.yaml'), '  approach: A new approach.\n');
  const site = buildContent('translated-site-outdated', dir);
  assert.ok(site.ok, site.output);
  for (const [type, en, pt, translated] of PAGE_TYPES) {
    if (!translated) continue;
    const notice = site.read(fileOf(pt)).match(/<p\b[^>]*class="translation-note outdated"[^>]*>(.*?)<\/p>/s);
    assert.ok(notice, `${type}: no outdated notice`);
    assert.match(notice[1], new RegExp(`<a href="${en}"`), `${type}: notice does not link to the Original`);
    const twin = site.read((pt === '/pt/' ? 'pt/index.md' : twinOf(pt).slice(1)));
    assert.ok(twin.includes('\noutdated: true\n'), `${type}: twin not outdated`);
  }
});

test('an outdated Translation of a legal document fails the build for any page type', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jds-translated-site-legal-'));
  cpSync(fixture, dir, { recursive: true });
  appendFileSync(join(dir, 'pages/projects/p1/privacy.md'), '\nA new clause.\n');
  const site = buildContent('translated-site-legal', dir);
  assert.equal(site.ok, false);
  assert.match(site.output, /pt\/projects\/p1\/privacy\.md: outdated Translation of a legal document/);
});

test('a Translation that disagrees with its Original on a shared field fails the build', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jds-translated-site-diverged-'));
  cpSync(fixture, dir, { recursive: true });
  const file = join(dir, 'articles/pt/a1.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace('part: 1', 'part: 2'));
  const site = buildContent('translated-site-diverged', dir);
  assert.equal(site.ok, false);
  assert.match(site.output, /articles\/pt\/a1\.md: a Translation keeps its Original's part \(1\), not 2/);
});
