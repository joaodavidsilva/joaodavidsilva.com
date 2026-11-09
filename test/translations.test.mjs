import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent, buildFixture } from './build.mjs';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'translations');
const SITE = 'https://joaodavidsilva.com';

/** A copy of the translations fixture, changed by `edit(dir)`, built with the real build. */
function buildEdited(name, edit) {
  const dir = mkdtempSync(join(tmpdir(), `jds-${name}-content-`));
  cpSync(fixture, dir, { recursive: true });
  edit(join(dir, 'pages'));
  return buildContent(name, dir);
}

/** `<link rel="alternate" hreflang>` tags as [hreflang, href]. */
const hreflangsOf = (html) =>
  [...html.matchAll(/<link\b[^>]*\bhreflang="([^"]+)"[^>]*>/g)].map(([tag, lang]) => [lang, tag.match(/href="([^"]+)"/)[1]]);

/** The language switcher's links as [hreflang, href, text, current]. */
function switcherOf(html) {
  const nav = html.match(/<nav\b[^>]*class="language-switcher"[^>]*>(.*?)<\/nav>/s);
  if (!nav) return null;
  return [...nav[1].matchAll(/<a\b([^>]*)>(.*?)<\/a>/gs)].map(([, attrs, text]) => [
    attrs.match(/hreflang="([^"]+)"/)[1],
    attrs.match(/href="([^"]+)"/)[1],
    text.trim(),
    /aria-current="page"/.test(attrs),
  ]);
}

const OUTDATED = /class="outdated-translation"/;
const AI_LABEL = /Translated by AI/;

test('Translations', async (t) => {
  const site = buildFixture('translations');
  assert.ok(site.ok, site.output);
  const original = site.read('guide/index.html');
  const pt = site.read('pt/guide/index.html');
  const es = site.read('es/guide/index.html');

  await t.test('a Portuguese Translation renders at /pt/ in Portuguese', () => {
    assert.match(pt, /<html lang="pt">/);
    assert.match(pt, /<h1>Guia de teste<\/h1>/);
    assert.match(pt, /O parágrafo do corpo traduzido\./);
    assert.match(pt, new RegExp(`<link rel="canonical" href="${SITE}/pt/guide/">`));
  });

  await t.test('a Portuguese Translation has its own Markdown twin', () => {
    assert.match(pt, /<link rel="alternate" type="text\/markdown" href="\/pt\/guide\.md">/);
    const md = site.read('pt/guide.md');
    for (const line of [
      'title: "Guia de teste"',
      'language: pt',
      `canonical: ${SITE}/pt/guide/`,
      `original: ${SITE}/guide/`,
      'outdated: false',
    ]) assert.ok(md.includes(`\n${line}\n`), `missing ${line}`);
    assert.match(md, /O parágrafo do corpo traduzido\./);
  });

  await t.test('the Original and its Translations link each other with hreflang', () => {
    const expected = [
      ['en', `${SITE}/guide/`],
      ['es', `${SITE}/es/guide/`],
      ['pt', `${SITE}/pt/guide/`],
      ['x-default', `${SITE}/guide/`],
    ];
    for (const html of [original, pt, es]) assert.deepEqual(hreflangsOf(html).sort(), expected);
    assert.deepEqual(hreflangsOf(site.read('solo/index.html')), []);
  });

  await t.test('JSON-LD relates a Translation to its Original', () => {
    const ld = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.deepEqual(ld(pt).translationOfWork, { '@type': 'WebPage', url: `${SITE}/guide/` });
    assert.deepEqual(ld(original).workTranslation.map((w) => w.url).sort(), [`${SITE}/es/guide/`, `${SITE}/pt/guide/`]);
  });

  await t.test('Portuguese carries no label; any other language is labelled "Translated by AI"', () => {
    assert.doesNotMatch(pt, AI_LABEL);
    assert.doesNotMatch(original, AI_LABEL);
    assert.match(es, AI_LABEL);
  });

  await t.test('an up-to-date Translation shows no outdated notice', () => {
    assert.doesNotMatch(pt, OUTDATED);
    assert.doesNotMatch(es, OUTDATED);
    assert.doesNotMatch(site.read('pt/terms/index.html'), OUTDATED);
  });

  await t.test('the language switcher offers exactly the languages the page exists in', () => {
    const expected = (current) => [
      ['en', '/guide/', 'English', current === 'en'],
      ['es', '/es/guide/', 'Español', current === 'es'],
      ['pt', '/pt/guide/', 'Português', current === 'pt'],
    ];
    assert.deepEqual(switcherOf(original), expected('en'));
    assert.deepEqual(switcherOf(pt), expected('pt'));
    assert.deepEqual(switcherOf(es), expected('es'));
    assert.deepEqual(switcherOf(site.read('terms/index.html')).map(([lang, href]) => [lang, href]), [
      ['en', '/terms/'],
      ['pt', '/pt/terms/'],
    ]);
    assert.equal(switcherOf(site.read('solo/index.html')), null);
  });

  await t.test('the language switcher never links to a missing page', () => {
    for (const file of ['guide/index.html', 'pt/guide/index.html', 'es/guide/index.html', 'terms/index.html', 'pt/terms/index.html']) {
      for (const [, href] of switcherOf(site.read(file))) assert.ok(site.has(`${href.slice(1)}index.html`), `${file} → ${href}`);
    }
  });

  await t.test('llms.txt lists Originals and points to their Translations', () => {
    const llms = site.read('llms.txt');
    const entries = llms.split('\n').filter((line) => line.startsWith('- '));
    assert.deepEqual(
      entries.map((line) => line.match(/^- \[([^\]]+)\]/)[1]),
      ['Guide fixture', 'Solo fixture', 'Terms fixture'],
    );
    const guide = entries.find((line) => line.startsWith('- [Guide fixture]'));
    assert.ok(guide.includes(`(${SITE}/guide.md)`), guide);
    assert.ok(guide.includes(`[Español](${SITE}/es/guide.md)`), guide);
    assert.ok(guide.includes(`[Português](${SITE}/pt/guide.md)`), guide);
    assert.doesNotMatch(entries.find((line) => line.startsWith('- [Solo fixture]')), /Translations/);
  });
});

test('editing an Original makes its Translations show the outdated notice', () => {
  const site = buildEdited('outdated', (pages) => appendFileSync(join(pages, 'guide.md'), '\nA new paragraph.\n'));
  assert.ok(site.ok, site.output);
  for (const [file, original] of [['pt/guide/index.html', '/guide/'], ['es/guide/index.html', '/guide/']]) {
    const notice = site.read(file).match(/<p\b[^>]*class="outdated-translation"[^>]*>(.*?)<\/p>/s);
    assert.ok(notice, `${file}: no outdated notice`);
    assert.match(notice[1], new RegExp(`<a href="${original}"[^>]*>`), `${file}: notice does not link to the Original`);
  }
  assert.ok(site.read('pt/guide.md').includes('\noutdated: true\n'));
  assert.doesNotMatch(site.read('guide/index.html'), OUTDATED);
  assert.doesNotMatch(site.read('pt/terms/index.html'), OUTDATED);
});

test('an outdated Translation of a legal document fails the build', () => {
  const site = buildEdited('outdated-legal', (pages) => appendFileSync(join(pages, 'terms.md'), '\nA new clause.\n'));
  assert.equal(site.ok, false);
  assert.match(site.output, /pt\/terms\.md: outdated Translation of a legal document/);
});

test('a Translation without an Original fails the build', () => {
  const site = buildEdited('orphan', (pages) =>
    writeFileSync(
      join(pages, 'pt', 'orphan.md'),
      '---\ntitle: Órfã\nsummary: Sem Original.\npublished: 2026-01-03\nlanguage: pt\ntranslatedFrom: "000000000000"\n---\n\nCorpo.\n',
    ),
  );
  assert.equal(site.ok, false);
  assert.match(site.output, /pt\/orphan\.md: Translation of a missing Original "\/orphan\/"/);
});
