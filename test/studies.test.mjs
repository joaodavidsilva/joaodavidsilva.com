import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sax from 'sax';
import { buildFixture, buildFixtureWithHistory } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://joaodavidsilva.com';
const SLEEP = `${SITE}/research/sleep-and-recall/`;

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
const sectionOf = (html, id) => html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>(.*?)</section>`, 's'))?.[1];

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

/** The titles of a strictly parsed Atom feed's entries, in order. */
function feedTitlesOf(xml) {
  const parser = sax.parser(true);
  const titles = [];
  let inEntry = false;
  let inTitle = false;
  parser.onopentag = ({ name }) => {
    if (name === 'entry') inEntry = true;
    if (inEntry && name === 'title') inTitle = true;
  };
  parser.ontext = (text) => {
    if (inTitle) titles.push(text);
  };
  parser.onclosetag = (name) => {
    if (name === 'entry') inEntry = false;
    if (name === 'title') inTitle = false;
  };
  parser.write(xml).close();
  return titles;
}

test('Studies, the Research index and Discussed-in backlinks', async (t) => {
  const site = buildFixtureWithHistory('studies', [{ date: '2026-04-02T09:00:00Z' }]);
  assert.ok(site.ok, site.output);
  const sleep = site.read('research/sleep-and-recall/index.html');
  const sleepMain = mainOf(sleep);
  const tabsMain = mainOf(site.read('research/tabs-and-focus/index.html'));

  await t.test('a Study renders its sections in order and its status without JavaScript', () => {
    assert.match(sleepMain, /<h1>Sleep and recall<\/h1>/);
    const text = textOf(sleepMain);
    assert.match(text, /Does a night's sleep improve recall of multiplication facts\?/);
    assert.match(sleepMain, /<time datetime="2026-03-10">10 March 2026<\/time>/);
    assert.match(text, /Status: Concluded/);
    const headings = [...sleepMain.matchAll(/<h2 id="([^"]+)">/g)].map((m) => m[1]);
    const sections = ['question', 'hypothesis', 'method', 'observations', 'findings', 'limitations'];
    assert.deepEqual(headings.filter((id) => sections.includes(id)), sections);
    assert.match(text, /Sleep and recall limitations paragraph\./);
    assert.doesNotMatch(sleep, /<script\b(?![^>]*(?:application\/ld\+json|data-theme-script))/);
  });

  await t.test('a Study links its data and scripts', () => {
    const section = sectionOf(sleepMain, 'data-and-scripts');
    assert.ok(section, 'no data and scripts section');
    const links = linksIn(section).map((l) => [l.text, l.href]);
    assert.deepEqual(links, [
      ['Recall scores', '/research/sleep-and-recall/recall.csv'],
      ['Analysis script', 'https://github.com/joaodavidsilva/sleep-and-recall/blob/main/analysis.py'],
    ]);
    assert.match(textOf(section), /Recall scores \(CSV, \d+ bytes\)/);
    const source = readFileSync(join(root, 'test/fixtures/studies/studies/sleep-and-recall/recall.csv'), 'utf8');
    assert.equal(site.read('research/sleep-and-recall/recall.csv'), source);
    assert.equal(sectionOf(tabsMain, 'data-and-scripts'), undefined);

    const { body } = twinOf(site.read('research/sleep-and-recall.md'));
    assert.match(
      body,
      new RegExp(
        '\\n## Data and scripts\\n\\n' +
          `- Data: \\[Recall scores\\]\\(${SITE}/research/sleep-and-recall/recall\\.csv\\) \\(CSV, \\d+ bytes\\)\\n` +
          '- Script: \\[Analysis script\\]\\(https://github\\.com/joaodavidsilva/sleep-and-recall/blob/main/analysis\\.py\\)\\n',
      ),
    );
  });

  await t.test('the Markdown twin carries the metadata, the status and the sections', () => {
    const { lines, body } = twinOf(site.read('research/sleep-and-recall.md'));
    for (const line of [
      'title: "Sleep and recall"',
      `summary: "Does a night's sleep improve recall of multiplication facts?"`,
      'published: 2026-03-10',
      'updated: 2026-04-02',
      'language: en',
      'tags: ["learning", "memory"]',
      `canonical: ${SLEEP}`,
      'status: concluded',
      'featured: false',
    ]) assert.ok(lines.includes(line), `missing ${line}`);
    assert.match(body, /^\n# Sleep and recall\n/);
    assert.match(body, /\n## Question\n\nDoes sleeping between practice sessions improve recall\?\n/);
    assert.match(body, /\n## Limitations\n\nSleep and recall limitations paragraph\.\n/);
    assert.ok(twinOf(site.read('research/longer-context.md')).lines.includes('status: in progress'));
    assert.match(sleep, /<link rel="alternate" type="text\/markdown" href="\/research\/sleep-and-recall\.md">/);
  });

  await t.test('JSON-LD describes the Study as a ScholarlyArticle with its status', () => {
    const ld = jsonLdOf(sleep);
    assert.equal(ld['@type'], 'ScholarlyArticle');
    assert.equal(ld.headline, 'Sleep and recall');
    assert.equal(ld.datePublished, '2026-03-10');
    assert.equal(ld.dateModified, '2026-04-02');
    assert.equal(ld.inLanguage, 'en');
    assert.deepEqual(ld.keywords, ['learning', 'memory']);
    assert.equal(ld.url, SLEEP);
    assert.equal(ld.creativeWorkStatus, 'Concluded');
    assert.equal(ld.author.name, 'João David Silva');
  });

  await t.test('an Article citing a Study produces a "Discussed in" backlink on the Study', () => {
    const section = sectionOf(sleepMain, 'discussed-in');
    assert.ok(section, 'no Discussed in section');
    assert.match(textOf(section), /^Discussed in /);
    assert.deepEqual(
      linksIn(section).map((l) => [l.text, l.href]),
      [
        ['What sleep taught', '/writing/what-sleep-taught/'],
        ['Older note', '/writing/older-note/'],
      ],
    );
    assert.match(section, /<time datetime="2026-03-20">20 March 2026<\/time>/);
    // A path in code is not a citation; an uncited Study has no backlinks.
    assert.equal(sectionOf(mainOf(site.read('research/longer-context/index.html')), 'discussed-in'), undefined);
    assert.equal(sectionOf(tabsMain, 'discussed-in'), undefined);
    assert.deepEqual(
      jsonLdOf(sleep).subjectOf.map((a) => [a['@type'], a.url]),
      [
        ['Article', `${SITE}/writing/what-sleep-taught/`],
        ['Article', `${SITE}/writing/older-note/`],
      ],
    );

    const { body } = twinOf(site.read('research/sleep-and-recall.md'));
    assert.match(
      body,
      new RegExp(
        '\\n## Discussed in\\n\\n' +
          `- \\[What sleep taught\\]\\(${SITE}/writing/what-sleep-taught\\.md\\) \\(2026-03-20\\)\\n` +
          `- \\[Older note\\]\\(${SITE}/writing/older-note\\.md\\) \\(2026-03-15\\)\\n`,
      ),
    );
    assert.doesNotMatch(site.read('research/longer-context.md'), /## Discussed in/);
    // "Suggest a correction" still closes the page.
    assert.equal(linksIn(sleepMain).at(-1).text, 'Suggest a correction');
  });

  await t.test('the Research index lists every Study with its status, abandoned ones included', () => {
    const index = site.read('research/index.html');
    const main = mainOf(index);
    assert.match(main, /<h1>Research<\/h1>/);
    const items = [...main.matchAll(/<li>(.*?)<\/li>/gs)].map(([, item]) => ({
      link: linksIn(item)[0],
      text: textOf(item),
    }));
    assert.deepEqual(
      items.map(({ link }) => [link.text, link.href]),
      [
        ['Longer context', '/research/longer-context/'],
        ['Sleep and recall', '/research/sleep-and-recall/'],
        ['Tabs and focus', '/research/tabs-and-focus/'],
      ],
    );
    assert.match(items[0].text, /In progress/);
    assert.match(items[1].text, /Concluded/);
    assert.match(items[2].text, /Abandoned/);
    assert.match(items[2].text, /Do fewer open browser tabs help focus\?/);
    assert.match(index, /<link rel="alternate" type="text\/markdown" href="\/research\.md">/);
    const ld = jsonLdOf(index);
    assert.equal(ld['@type'], 'CollectionPage');
    assert.equal(ld.url, `${SITE}/research/`);
    assert.equal(ld.mainEntity.itemListElement.length, 3);

    const { lines, body } = twinOf(site.read('research.md'));
    assert.ok(lines.includes(`canonical: ${SITE}/research/`));
    const listed = [...body.matchAll(/^- \[([^\]]+)\]\(([^)]+)\) \(([^)]+)\)/gm)].map((m) => [m[1], m[2], m[3]]);
    assert.deepEqual(listed, [
      ['Longer context', `${SITE}/research/longer-context.md`, '2026-04-01, in progress'],
      ['Sleep and recall', `${SITE}/research/sleep-and-recall.md`, '2026-03-10, concluded'],
      ['Tabs and focus', `${SITE}/research/tabs-and-focus.md`, '2026-02-01, abandoned'],
    ]);
  });

  await t.test('abandoned Studies stay published', () => {
    assert.match(tabsMain, /<h1>Tabs and focus<\/h1>/);
    assert.match(textOf(tabsMain), /Status: Abandoned/);
    assert.match(textOf(tabsMain), /Abandoned: the measure of focus was not reliable\./);
    assert.ok(twinOf(site.read('research/tabs-and-focus.md')).lines.includes('status: abandoned'));
  });

  await t.test('Studies appear in the feed beside Articles, newest first', () => {
    assert.deepEqual(feedTitlesOf(site.read('feed.xml')), [
      'Longer context',
      'What sleep taught',
      'Older note',
      'Unrelated',
      'Sleep and recall',
      'Tabs and focus',
    ]);
    assert.match(site.read('feed.xml'), new RegExp(`<link rel="alternate" type="text/html" href="${SLEEP}"/>`));
  });

  await t.test('llms.txt lists the Research index and every Study with its status', () => {
    const llms = site.read('llms.txt');
    assert.match(llms, /^## Research$/m);
    assert.match(llms, new RegExp(`^- \\[Research\\]\\(${SITE}/research\\.md\\): .+$`, 'm'));
    assert.match(
      llms,
      new RegExp(`^- \\[Sleep and recall\\]\\(${SITE}/research/sleep-and-recall\\.md\\): Does a night's sleep improve recall of multiplication facts\\? \\(concluded\\)$`, 'm'),
    );
    assert.match(llms, new RegExp(`^- \\[Tabs and focus\\]\\(${SITE}/research/tabs-and-focus\\.md\\): .+ \\(abandoned\\)$`, 'm'));
    assert.match(llms, new RegExp(`^- \\[Longer context\\]\\(${SITE}/research/longer-context\\.md\\): .+ \\(in progress\\)$`, 'm'));
  });
});

test('a Study missing a required section fails the build', () => {
  const site = buildFixture('study-missing-section');
  assert.equal(site.ok, false);
  assert.match(site.output, /no-limits\.md: a Study needs a "## Limitations" section/);
});

test('a Study with its sections out of order fails the build', () => {
  const site = buildFixture('study-section-order');
  assert.equal(site.ok, false);
  assert.match(site.output, /backwards\.md: "## Findings" must come after "## Observations"/);
});
