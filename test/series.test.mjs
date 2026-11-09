import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture } from './build.mjs';

const SITE = 'https://joaodavidsilva.com';

const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const textOf = (html) => decode(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const mainOf = (html) => html.match(/<main\b[^>]*>(.*)<\/main>/s)[1];
const jsonLdOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);

/** Every link in a fragment as { href, text, attrs }. */
function linksIn(fragment) {
  return [...fragment.matchAll(/<a\b([^>]*)>(.*?)<\/a>/gs)].map(([, attributes, text]) => {
    const attrs = Object.fromEntries(
      [...attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, name, value = '']) => [name, decode(value)]),
    );
    return { href: attrs.href, text: textOf(text), attrs };
  });
}

/** The front-matter lines and body of a Markdown twin. */
function twinOf(md) {
  const [, frontMatter, body] = md.match(/^---\n(.*?)\n---\n(.*)$/s);
  return { lines: frontMatter.split('\n'), body };
}

/** The Series navigation of an Article page, as [text, href] links. */
function seriesNavOf(html) {
  const nav = mainOf(html).match(/<nav\b[^>]*aria-label="Series[^"]*"[^>]*>(.*?)<\/nav>/s)?.[1];
  assert.ok(nav, 'no Series navigation');
  return linksIn(nav).map((l) => [l.text, l.href]);
}

test('a Series and its parts', async (t) => {
  const site = buildFixture('series');
  assert.ok(site.ok, site.output);
  const series = site.read('writing/series/doghouse/index.html');
  const seriesMain = mainOf(series);

  await t.test('the Series page shows its title, introduction and status', () => {
    assert.match(seriesMain, /<h1>The doghouse build<\/h1>/);
    const text = textOf(seriesMain);
    assert.match(text, /Building a doghouse from a sketch to a roof, one weekend at a time\./);
    assert.match(text, /The doghouse introduction paragraph: why a doghouse, and what each part covers\./);
    assert.match(text, /Ongoing/);
    assert.match(textOf(mainOf(site.read('writing/series/workbench/index.html'))), /Complete/);
    assert.doesNotMatch(series, /<script\b(?![^>]*(?:application\/ld\+json|data-theme-script))/);
  });

  await t.test('the Series page lists its parts in order', () => {
    const parts = seriesMain.match(/<ol\b[^>]*>(.*?)<\/ol>/s)?.[1];
    assert.ok(parts, 'no ordered list of parts');
    assert.deepEqual(
      linksIn(parts).map((l) => [l.text, l.href]),
      [
        ['Pouring the base', '/writing/pouring-the-base/'],
        ['Framing', '/writing/framing/'],
        ['Roofing', '/writing/roofing/'],
      ],
    );
    assert.match(textOf(parts), /Walls that stay square\./);
    assert.match(parts, /<time datetime="2026-02-14">14 February 2026<\/time>/);
  });

  await t.test('the Series page advertises its twin and describes itself in JSON-LD', () => {
    assert.match(series, /<link rel="alternate" type="text\/markdown" href="\/writing\/series\/doghouse\.md">/);
    const ld = jsonLdOf(series);
    assert.equal(ld['@type'], 'CreativeWorkSeries');
    assert.equal(ld.name, 'The doghouse build');
    assert.equal(ld.url, `${SITE}/writing/series/doghouse/`);
    assert.equal(ld.creativeWorkStatus, 'ongoing');
    assert.deepEqual(
      ld.hasPart.map((p) => [p.position, p.url]),
      [
        [1, `${SITE}/writing/pouring-the-base/`],
        [2, `${SITE}/writing/framing/`],
        [3, `${SITE}/writing/roofing/`],
      ],
    );
  });

  await t.test("the Series page's Markdown twin lists every part in order", () => {
    const { lines, body } = twinOf(site.read('writing/series/doghouse.md'));
    for (const line of [
      'title: "The doghouse build"',
      'summary: "Building a doghouse from a sketch to a roof, one weekend at a time."',
      'published: 2026-01-10',
      'language: en',
      `canonical: ${SITE}/writing/series/doghouse/`,
      'status: ongoing',
    ]) assert.ok(lines.includes(line), `missing ${line}`);
    assert.match(body, /^\n# The doghouse build\n/);
    assert.match(body, /The doghouse introduction paragraph/);
    const parts = [...body.matchAll(/^(\d+)\. \[([^\]]+)\]\(([^)]+)\)/gm)].map((m) => [m[1], m[2], m[3]]);
    assert.deepEqual(parts, [
      ['1', 'Pouring the base', `${SITE}/writing/pouring-the-base.md`],
      ['2', 'Framing', `${SITE}/writing/framing.md`],
      ['3', 'Roofing', `${SITE}/writing/roofing.md`],
    ]);
  });

  await t.test('each part shows its position in the Series', () => {
    const main = mainOf(site.read('writing/framing/index.html'));
    assert.match(textOf(main), /Part 2 of 3 · The doghouse build/);
    assert.ok(linksIn(main).some((l) => l.text === 'The doghouse build' && l.href === '/writing/series/doghouse/'));
    assert.match(textOf(mainOf(site.read('writing/bench-top/index.html'))), /Part 1 of 1 · The workbench/);
    assert.doesNotMatch(textOf(mainOf(site.read('writing/standalone/index.html'))), /Part \d/);
  });

  await t.test('each part links to the previous and next parts', () => {
    assert.deepEqual(seriesNavOf(site.read('writing/pouring-the-base/index.html')), [['Next: Framing', '/writing/framing/']]);
    assert.deepEqual(seriesNavOf(site.read('writing/framing/index.html')), [
      ['Previous: Pouring the base', '/writing/pouring-the-base/'],
      ['Next: Roofing', '/writing/roofing/'],
    ]);
    assert.deepEqual(seriesNavOf(site.read('writing/roofing/index.html')), [['Previous: Framing', '/writing/framing/']]);
    assert.doesNotMatch(mainOf(site.read('writing/standalone/index.html')), /aria-label="Series/);
  });

  await t.test("a part's twin and JSON-LD carry its place in the Series", () => {
    const { lines, body } = twinOf(site.read('writing/framing.md'));
    for (const line of [
      'series:',
      '  title: "The doghouse build"',
      `  canonical: ${SITE}/writing/series/doghouse/`,
      '  part: 2',
      '  of: 3',
    ]) assert.ok(lines.includes(line), `missing ${line}`);
    assert.match(body, new RegExp(`^\\n# Framing\\n\\nPart 2 of 3 · \\[The doghouse build\\]\\(${SITE}/writing/series/doghouse\\.md\\)\\n`));
    assert.match(body, new RegExp(`\\n- Previous: \\[Pouring the base\\]\\(${SITE}/writing/pouring-the-base\\.md\\)\\n- Next: \\[Roofing\\]\\(${SITE}/writing/roofing\\.md\\)\\n`));
    assert.ok(!twinOf(site.read('writing/standalone.md')).lines.includes('series:'));

    const ld = jsonLdOf(site.read('writing/framing/index.html'));
    assert.equal(ld.position, 2);
    assert.deepEqual(ld.isPartOf, { '@type': 'CreativeWorkSeries', name: 'The doghouse build', url: `${SITE}/writing/series/doghouse/` });
  });

  await t.test('the Writing index and llms.txt list every Series', () => {
    const index = mainOf(site.read('writing/index.html'));
    assert.ok(linksIn(index).some((l) => l.text === 'The doghouse build' && l.href === '/writing/series/doghouse/'));
    assert.ok(linksIn(index).some((l) => l.text === 'The workbench' && l.href === '/writing/series/workbench/'));
    assert.match(site.read('writing.md'), new RegExp(`^- \\[The doghouse build\\]\\(${SITE}/writing/series/doghouse\\.md\\)`, 'm'));
    assert.match(
      site.read('llms.txt'),
      new RegExp(`^- \\[The doghouse build\\]\\(${SITE}/writing/series/doghouse\\.md\\): Building a doghouse from a sketch to a roof, one weekend at a time\\.$`, 'm'),
    );
  });
});

test('two Articles claiming the same position in a Series fail the build', () => {
  const site = buildFixture('series-duplicate-part');
  assert.equal(site.ok, false);
  assert.match(site.output, /Series "doghouse": part 2 is claimed by both "framing" and "walls"/);
});

test('a Series with a missing part fails the build', () => {
  const site = buildFixture('series-missing-part');
  assert.equal(site.ok, false);
  assert.match(site.output, /Series "doghouse": part 2 is missing/);
});
