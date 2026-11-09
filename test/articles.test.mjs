import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sax from 'sax';
import { buildFixture, buildFixtureWithHistory } from './build.mjs';
import { stylesheetsOf, nestedRulesOf } from './css.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://joaodavidsilva.com';
const FIRST = `${SITE}/writing/first-light/`;
const SECOND = `${SITE}/writing/second-thoughts/`;

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

/** A strictly parsed XML document as nested { name, attributes, children, text }. */
function parseXml(xml) {
  const parser = sax.parser(true, { xmlns: true });
  const rootNode = { children: [] };
  const stack = [rootNode];
  parser.onopentag = (node) => {
    const element = { name: node.local, uri: node.uri, attributes: node.attributes, children: [], text: '' };
    stack.at(-1).children.push(element);
    stack.push(element);
  };
  parser.ontext = parser.oncdata = (text) => {
    stack.at(-1).text += text;
  };
  parser.onclosetag = () => stack.pop();
  parser.write(xml).close();
  return rootNode.children[0];
}

const childrenNamed = (element, name) => element.children.filter((c) => c.name === name);
const childNamed = (element, name) => childrenNamed(element, name)[0];
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

test('Articles, the Writing index and the feed', async (t) => {
  // first-light is published on 1 Feb and changed in git on 1 Mar and 15 Apr;
  // second-thoughts is published on 20 Feb and committed on 1 Mar.
  const site = buildFixtureWithHistory('articles', [
    { date: '2026-03-01T09:00:00Z' },
    { date: '2026-04-15T10:00:00Z', touch: ['articles/first-light.md'] },
  ]);
  assert.ok(site.ok, site.output);
  const first = site.read('writing/first-light/index.html');
  const second = site.read('writing/second-thoughts/index.html');
  const firstMain = mainOf(first);

  await t.test('an Article renders its title, summary, date, tags and body without JavaScript', () => {
    assert.match(firstMain, /<h1>First light<\/h1>/);
    const text = textOf(firstMain);
    assert.match(text, /What the first working prototype taught about measuring twice\./);
    assert.match(firstMain, /<time datetime="2026-02-01">1 February 2026<\/time>/);
    assert.match(text, /prototyping/);
    assert.match(text, /measurement/);
    assert.match(text, /\d+ min read/);
    assert.match(text, /The first light body paragraph\./);
    assert.doesNotMatch(first, /<script\b(?![^>]*application\/ld\+json)/);
  });

  await t.test('"Last updated" comes from git history, not front-matter', () => {
    assert.match(firstMain, /Updated <time datetime="2026-04-15">15 April 2026<\/time>/);
    assert.equal(jsonLdOf(first).dateModified, '2026-04-15');
    assert.ok(twinOf(site.read('writing/first-light.md')).lines.includes('updated: 2026-04-15'));
    assert.equal(jsonLdOf(second).dateModified, '2026-03-01');
    assert.ok(twinOf(site.read('writing/second-thoughts.md')).lines.includes('updated: 2026-03-01'));
  });

  await t.test('an Article advertises its Markdown twin and the feed', () => {
    assert.match(first, /<link rel="alternate" type="text\/markdown" href="\/writing\/first-light\.md">/);
    assert.match(first, /<link rel="alternate" type="application\/atom\+xml"[^>]* href="\/feed\.xml">/);
  });

  await t.test('the Markdown twin carries the metadata and the body', () => {
    const { lines, body } = twinOf(site.read('writing/first-light.md'));
    for (const line of [
      'title: "First light"',
      'summary: "What the first working prototype taught about measuring twice."',
      'published: 2026-02-01',
      'language: en',
      'tags: ["prototyping", "measurement"]',
      `canonical: ${FIRST}`,
      'featured: true',
      'discuss:',
      '  linkedin: https://www.linkedin.com/posts/joaodavidsilvaa_first-light-123',
    ]) assert.ok(lines.includes(line), `missing ${line}`);
    assert.match(body, /^\n# First light\n/);
    assert.match(body, /The first light body paragraph\./);
    assert.match(body, /> \[!WARNING\]/);
  });

  await t.test('JSON-LD describes the Article', () => {
    const ld = jsonLdOf(first);
    assert.equal(ld['@type'], 'Article');
    assert.equal(ld.headline, 'First light');
    assert.equal(ld.description, 'What the first working prototype taught about measuring twice.');
    assert.equal(ld.datePublished, '2026-02-01');
    assert.equal(ld.inLanguage, 'en');
    assert.deepEqual(ld.keywords, ['prototyping', 'measurement']);
    assert.equal(ld.url, FIRST);
    assert.equal(ld.author.name, 'João David Silva');
    assert.deepEqual(
      ld.correction.map((c) => [c.datePublished, c.text]),
      [
        ['2026-02-10', 'The second measurement was in millimetres, not centimetres.'],
        ['2026-03-20', 'Added the missing cut list.'],
      ],
    );
  });

  await t.test('llms.txt lists the Writing index and every Article', () => {
    const llms = site.read('llms.txt');
    assert.match(llms, /^## Writing$/m);
    assert.match(llms, new RegExp(`^- \\[Writing\\]\\(${SITE}/writing\\.md\\): .+$`, 'm'));
    assert.match(
      llms,
      new RegExp(`^- \\[First light\\]\\(${SITE}/writing/first-light\\.md\\): What the first working prototype taught about measuring twice\\.$`, 'm'),
    );
    assert.match(llms, new RegExp(`^- \\[Second thoughts\\]\\(${SITE}/writing/second-thoughts\\.md\\): Revisiting the prototype a month later\\.$`, 'm'));
  });

  await t.test('Corrections render as visible dated notes on the Article and in its twin', () => {
    const section = firstMain.match(/<section\b[^>]*id="corrections"[^>]*>(.*?)<\/section>/s)?.[1];
    assert.ok(section, 'no corrections section');
    const text = textOf(section);
    assert.match(text, /Corrections/);
    assert.match(section, /<time datetime="2026-02-10">10 February 2026<\/time>/);
    assert.match(text, /The second measurement was in millimetres, not centimetres\./);
    assert.match(section, /<time datetime="2026-03-20">20 March 2026<\/time>/);
    assert.match(text, /Added the missing cut list\./);
    assert.doesNotMatch(mainOf(second), /id="corrections"/);

    const { body } = twinOf(site.read('writing/first-light.md'));
    assert.match(body, /\n## Corrections\n\n- 2026-02-10: The second measurement was in millimetres, not centimetres\.\n- 2026-03-20: Added the missing cut list\.\n/);
    assert.doesNotMatch(site.read('writing/second-thoughts.md'), /## Corrections/);
  });

  await t.test('attachments are downloadable and linked', () => {
    const source = readFileSync(join(root, 'test/fixtures/articles/articles/first-light/materials.csv'), 'utf8');
    assert.equal(site.read('writing/first-light/materials.csv'), source);
    const link = linksIn(firstMain).find((l) => l.href === '/writing/first-light/materials.csv' && 'download' in l.attrs);
    assert.ok(link, 'no download link to the attachment');
    assert.equal(link.text, 'Materials list');
    assert.match(textOf(firstMain), /materials\.csv, CSV, \d+ bytes/);
    const { body } = twinOf(site.read('writing/first-light.md'));
    assert.match(body, new RegExp(`\\n## Attachments\\n\\n- \\[Materials list\\]\\(${SITE}/writing/first-light/materials\\.csv\\) \\(materials\\.csv, CSV, \\d+ bytes\\)\\n`));
  });

  await t.test('Discuss links appear only when set', () => {
    const discuss = linksIn(firstMain).filter((l) => /^Discuss/.test(l.text));
    assert.deepEqual(
      discuss.map((l) => [l.text, l.href]),
      [['Discuss on LinkedIn', 'https://www.linkedin.com/posts/joaodavidsilvaa_first-light-123']],
    );
    assert.deepEqual(linksIn(mainOf(second)).filter((l) => /Discuss/.test(l.text)), []);
    assert.ok(!twinOf(site.read('writing/second-thoughts.md')).lines.some((l) => l.startsWith('discuss')));
    // "Suggest a correction" still closes the page.
    assert.equal(linksIn(firstMain).at(-1).text, 'Suggest a correction');
    assert.equal(linksIn(mainOf(second)).at(-1).text, 'Suggest a correction');
  });

  await t.test('the Writing index lists Articles newest first', () => {
    const index = site.read('writing/index.html');
    const main = mainOf(index);
    assert.match(main, /<h1>Writing<\/h1>/);
    const titles = linksIn(main)
      .filter((l) => l.href.startsWith('/writing/'))
      .map((l) => [l.text, l.href]);
    assert.deepEqual(titles, [
      ['Second thoughts', '/writing/second-thoughts/'],
      ['First light', '/writing/first-light/'],
    ]);
    assert.match(textOf(main), /Revisiting the prototype a month later\./);
    assert.match(main, /<time datetime="2026-02-20">20 February 2026<\/time>/);
    assert.match(index, /<link rel="alternate" type="text\/markdown" href="\/writing\.md">/);
    const ld = jsonLdOf(index);
    assert.equal(ld.url, `${SITE}/writing/`);
    assert.deepEqual(ld.mainEntity.itemListElement.map((i) => i.url), [SECOND, FIRST]);

    const { lines, body } = twinOf(site.read('writing.md'));
    assert.ok(lines.includes(`canonical: ${SITE}/writing/`));
    assert.ok(lines.includes('updated: 2026-04-15'));
    const listed = [...body.matchAll(/^- \[([^\]]+)\]\(([^)]+)\)/gm)].map((m) => [m[1], m[2]]);
    assert.deepEqual(listed, [
      ['Second thoughts', `${SITE}/writing/second-thoughts.md`],
      ['First light', `${SITE}/writing/first-light.md`],
    ]);
  });

  await t.test('the feed is a valid Atom feed of the Articles, newest first', () => {
    const feed = parseXml(site.read('feed.xml'));
    assert.equal(feed.name, 'feed');
    assert.equal(feed.uri, 'http://www.w3.org/2005/Atom');
    assert.equal(childrenNamed(feed, 'id').length, 1);
    assert.ok(new URL(childNamed(feed, 'id').text));
    assert.ok(childNamed(feed, 'title').text.trim());
    assert.match(childNamed(feed, 'updated').text, RFC3339);
    assert.ok(childNamed(childNamed(feed, 'author'), 'name').text.trim());
    const links = childrenNamed(feed, 'link').map((l) => [l.attributes.rel?.value ?? 'alternate', l.attributes.href.value]);
    assert.deepEqual(new Map(links).get('self'), `${SITE}/feed.xml`);
    assert.deepEqual(new Map(links).get('alternate'), `${SITE}/`);

    const entries = childrenNamed(feed, 'entry');
    assert.deepEqual(entries.map((e) => childNamed(e, 'title').text), ['Second thoughts', 'First light']);
    const ids = entries.map((e) => childNamed(e, 'id').text);
    assert.equal(new Set(ids).size, ids.length);
    for (const entry of entries) {
      assert.ok(new URL(childNamed(entry, 'id').text));
      assert.match(childNamed(entry, 'updated').text, RFC3339);
      assert.match(childNamed(entry, 'published').text, RFC3339);
      assert.ok(childNamed(entry, 'summary').text.trim());
    }
    const firstEntry = entries[1];
    assert.equal(childNamed(firstEntry, 'link').attributes.href.value, FIRST);
    assert.match(childNamed(firstEntry, 'updated').text, /^2026-04-15T/);
    assert.match(childNamed(feed, 'updated').text, /^2026-04-15T/);
    assert.deepEqual(childrenNamed(firstEntry, 'category').map((c) => c.attributes.term.value), ['prototyping', 'measurement']);
  });

  await t.test('code is highlighted with the theme palette', () => {
    const pre = firstMain.match(/<pre\b[^>]*>.*?<\/pre>/s)?.[0];
    assert.ok(pre, 'no code block');
    assert.doesNotMatch(pre, /#[0-9a-f]{3,8}\b/i, 'code block hard-codes a colour');
    const used = [...new Set([...pre.matchAll(/var\((--astro-code-[\w-]+)\)/g)].map((m) => m[1]))];
    assert.ok(used.some((v) => v.startsWith('--astro-code-token-')), 'code is not highlighted');
    // Every colour resolves to a palette text colour on the code surface, so the
    // contrast guarantees of the palette hold for code, in both modes.
    const custom = new Map(
      nestedRulesOf(stylesheetsOf(site, first))
        .flatMap((r) => r.declarations)
        .filter(([p]) => p.startsWith('--astro-code-')),
    );
    for (const name of used) {
      const expected = name === '--astro-code-background' ? ['var(--surface)'] : ['var(--ink)', 'var(--ink-muted)', 'var(--accent)'];
      assert.ok(expected.includes(custom.get(name)), `${name} is ${custom.get(name)}`);
    }
    assert.equal(custom.get('--astro-code-token-keyword'), 'var(--accent)');
    assert.equal(custom.get('--astro-code-token-comment'), 'var(--ink-muted)');
  });

  await t.test('figures, footnotes and callouts render as semantic HTML', () => {
    const figure = firstMain.match(/<figure>(.*?)<\/figure>/s)?.[1];
    assert.ok(figure, 'no figure');
    assert.match(figure, /<img\b[^>]*alt="A sketch of the frame"/);
    assert.match(figure, /<figcaption>The frame, before the first cut<\/figcaption>/);

    const ref = linksIn(firstMain).find((l) => 'data-footnote-ref' in l.attrs);
    assert.ok(ref, 'no footnote reference');
    const footnote = firstMain.match(new RegExp(`<li id="${ref.href.slice(1)}">(.*?)</li>`, 's'))?.[1];
    assert.match(textOf(footnote ?? ''), /About twice as long\./);

    const callout = firstMain.match(/<div class="callout" role="note" data-kind="warning">(.*?)<\/div>/s)?.[1];
    assert.ok(callout, 'no warning callout');
    assert.match(textOf(callout), /^Warning Always unplug the saw first\.$/);
  });

  await t.test('cross-references link Articles, sections and attachments', () => {
    const hrefs = linksIn(firstMain).map((l) => l.href);
    for (const href of ['/writing/second-thoughts/#what-changed', '#measuring-twice', '/writing/first-light/materials.csv']) {
      assert.ok(hrefs.includes(href), `missing ${href}`);
    }
    assert.match(second, /<h2 id="what-changed">/);
  });

  await t.test("relative image links in the Markdown twin resolve to the Article's own files", () => {
    const twinUrl = new URL('/writing/first-light.md', SITE);
    const images = [...site.read('writing/first-light.md').matchAll(/!\[[^\]]*\]\((\S+)/g)].map((m) => m[1]);
    assert.ok(images.length, 'no image in the twin');
    for (const image of images) {
      const path = new URL(image, twinUrl).pathname;
      assert.ok(site.has(path.slice(1)), `${image} resolves to ${path}, which was not built`);
    }
  });
});

test('a broken internal link fails the build', () => {
  const site = buildFixture('broken-link');
  assert.equal(site.ok, false);
  assert.match(site.output, /\/writing\/linker\/ links to \/writing\/missing\/, which does not exist/);
  assert.match(site.output, /\/writing\/linker\/ links to #nowhere, which does not exist/);
});

test('an Article with a missing attachment fails the build', () => {
  const site = buildFixture('missing-attachment');
  assert.equal(site.ok, false);
  assert.match(site.output, /lonely\.md: attachment "absent\.csv" not found/);
});

test('an Article that sets its own "last updated" date fails the build', () => {
  const site = buildFixture('article-updated');
  assert.equal(site.ok, false);
  assert.match(site.output, /dated\.md/);
  assert.match(site.output, /"last updated" comes from git history/);
});
