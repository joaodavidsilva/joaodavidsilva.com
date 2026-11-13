import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture } from './build.mjs';
import { nestedRulesOf, stylesheetsOf } from './css.mjs';

const SKILLS = 'https://github.com/joaodavidsilva/skills/blob/main';

test('Knowledge Base entries are published', async (t) => {
  const site = buildFixture('knowledge');
  assert.ok(site.ok, site.output);
  const concept = site.read('knowledge/context-window/index.html');
  const guide = site.read('knowledge/writing-tests-first/index.html');

  await t.test('entries render under the agent-readability contract', () => {
    assert.match(concept, /<h1>Context window<\/h1>/);
    assert.match(concept, /The context window body paragraph\./);
    assert.doesNotMatch(concept, /<script(?![^>]*(?:application\/ld\+json|data-theme-script|data-menu-script))/);
    assert.match(concept, /<link rel="alternate" type="text\/markdown" href="\/knowledge\/context-window\.md">/);
    const ld = JSON.parse(concept.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(ld.headline, 'Context window');
    assert.equal(ld.url, 'https://joaodavidsilva.com/knowledge/context-window/');
    const md = site.read('knowledge/context-window.md');
    for (const line of [
      'title: "Context window"',
      'summary: "The tokens a model can attend to at once."',
      'kind: concept',
      'category: "Context Engineering"',
      'tags: ["context", "tokens"]',
      'canonical: https://joaodavidsilva.com/knowledge/context-window/',
    ]) assert.ok(md.includes(`\n${line}\n`), `missing ${line}`);
    assert.match(md, /\nupdated: \d{4}-\d{2}-\d{2}\n/);
    assert.ok(md.includes('\npublished: 2026-03-04\n'), md);
    assert.equal(ld.datePublished, '2026-03-04');
    assert.match(md, /The context window body paragraph\./);
    assert.match(
      site.read('llms.txt'),
      /- \[Context window\]\(https:\/\/joaodavidsilva\.com\/knowledge\/context-window\.md\): The tokens a model can attend to at once\./,
    );
  });

  await t.test('entries show when they were last updated', () => {
    assert.match(concept, /Last updated <time datetime="\d{4}-\d{2}-\d{2}">/);
  });

  await t.test('entry chrome preserves its kind, category, Markdown twin and tag links', () => {
    assert.match(concept, /href="\/knowledge\/">Knowledge<\/a>/);
    assert.match(concept, /data-pagefind-meta="kind">Concept<\/span>/);
    assert.match(concept, /data-pagefind-meta="category">Context Engineering<\/a>/);
    assert.match(concept, /class="article-dek"/);
    assert.match(concept, /href="\/knowledge\/context-window\.md">Read as Markdown<\/a>/);
    assert.match(concept, /class="pill" href="\/knowledge\/tags\/tokens\/">#tokens<\/a>/);
  });

  await t.test('Concept cross-references resolve to the related Concept, beside its kind and category', () => {
    assert.match(concept, /<a href="\/knowledge\/token-budget\/">Token budget<\/a>/);
    const related = concept.slice(concept.indexOf('<a href="/knowledge/token-budget/">'));
    assert.match(related.slice(0, 300), /Concept · Context Engineering/, 'related entries name their kind and category');
  });

  await t.test('a Guide with a valid Skill links to its SKILL.md', () => {
    assert.match(guide, /data-pagefind-meta="kind">Guide<\/span>/);
    assert.ok(guide.includes(`href="${SKILLS}/skills/engineering/tdd/SKILL.md"`));
    assert.match(site.read('knowledge/tags/tdd/index.html'), /Guide · Development Processes &amp; Methodologies/);
    assert.ok(site.read('knowledge/writing-tests-first.md').includes(`\nskill: ${SKILLS}/skills/engineering/tdd/SKILL.md\n`));
  });

  await t.test('the index derives its totals and groups entries into anchored category rows', () => {
    const index = site.read('knowledge/index.html');
    assert.match(index, /<h1 class="page-title">Engineering with and for AI agents\.<\/h1>/);
    assert.match(index, /Concepts and Guides, by category\. Each entry is one idea, defined once and linked everywhere it is used\./);
    assert.match(index, /3 entries in 2 categories/);
    const ctx = index.indexOf('<h2 id="context-engineering">Context Engineering</h2>');
    const dev = index.indexOf('<h2 id="development-processes-methodologies">Development Processes &amp; Methodologies</h2>');
    assert.ok(ctx > -1 && dev > -1, index);
    const ctxSection = index.slice(ctx, dev);
    assert.match(ctxSection, /2 entries/);
    assert.match(ctxSection, /<dt><a href="\/knowledge\/context-window\/">Context window<\/a><\/dt>\s*<dd>The tokens a model can attend to at once\.<\/dd>/);
    assert.match(ctxSection, /href="\/knowledge\/token-budget\/"/);
    assert.match(index.slice(dev), /1 entry/);
    assert.match(index.slice(dev), /href="\/knowledge\/writing-tests-first\/"/);
    assert.match(index, /data-knowledge-index/);
    assert.doesNotMatch(index, /AI Engineering<\/h2>/, 'empty categories are omitted');
    assert.match(site.read('knowledge.md'), /\[Context window\]\(https:\/\/joaodavidsilva\.com\/knowledge\/context-window\.md\)/);
  });

  await t.test('the index links tag pills to their real filtered pages', () => {
    assert.match(site.read('knowledge/index.html'), /<a class="pill" href="\/knowledge\/tags\/tokens\/">#tokens<\/a>/);
    const tokens = site.read('knowledge/tags/tokens/index.html');
    assert.match(tokens, /href="\/knowledge\/context-window\/"/);
    assert.match(tokens, /href="\/knowledge\/token-budget\/"/);
    assert.doesNotMatch(tokens, /href="\/knowledge\/writing-tests-first\/"/);
    assert.ok(site.has('knowledge/tags/tokens.md'));
  });

  await t.test('the index lists its tags alphabetically, after the categories', () => {
    const index = site.read('knowledge/index.html');
    const order = [...index.matchAll(/href="\/knowledge\/tags\/([^/]+)\/"/g)].map((m) => m[1]);
    assert.deepEqual(order, ['context', 'tdd', 'testing', 'tokens']);
    assert.ok(index.indexOf('href="/knowledge/tags/') > index.indexOf('href="/knowledge/writing-tests-first/"'),
      'tags follow the categories');
  });

  await t.test('a tag page names each entry with its kind and category', () => {
    const tokens = site.read('knowledge/tags/tokens/index.html');
    assert.match(tokens, /Knowledge Base entries tagged “tokens”\./);
    assert.match(tokens, /2 entries/);
    for (const title of ['Context window', 'Token budget']) {
      assert.match(tokens, new RegExp(`${title}</a>[^]{0,200}Concept · Context Engineering`), title);
    }
  });

  await t.test('Knowledge controls stay touch-sized and category groups collapse on mobile', () => {
    const index = site.read('knowledge/index.html');
    const rules = nestedRulesOf(stylesheetsOf(site, index));
    const declares = (selector, property, value, context) => rules.some((rule) =>
      rule.prelude.split(',').map((part) => part.trim()).includes(selector)
      && rule.declarations.some(([name, actual]) => name === property && actual === value)
      && (!context || rule.context.includes(context)));
    assert.ok(declares('.knowledge-search input', 'min-block-size', '60px'));
    assert.ok(declares('.pill', 'min-block-size', '44px'));
    assert.ok(declares('.knowledge-list a', 'min-block-size', '44px'));
    assert.ok(declares('.knowledge-related a', 'min-block-size', '44px'));
    assert.ok(declares('.knowledge-skill a', 'min-block-size', '44px'));
    assert.ok(declares('.knowledge-back a', 'min-block-size', '44px'));
    assert.ok(declares('.knowledge-entry .content-footer a', 'min-block-size', '44px'));
    assert.ok(declares('.knowledge-category', 'display', 'block', '@media(width<=640px)'));
    assert.ok(declares('.knowledge-search input', 'inline-size', '100%'));
  });

  await t.test('the index and tag pages are agent-readable', () => {
    for (const [html, path, twin] of [
      ['knowledge/index.html', '/knowledge/', 'knowledge.md'],
      ['knowledge/tags/tokens/index.html', '/knowledge/tags/tokens/', 'knowledge/tags/tokens.md'],
    ]) {
      const ld = JSON.parse(site.read(html).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
      assert.equal(ld['@type'], 'CollectionPage', html);
      assert.equal(ld.url, `https://joaodavidsilva.com${path}`);
      assert.equal(ld.datePublished, '2026-03-04');
      assert.ok(ld.mainEntity.itemListElement.some((item) => item.url === 'https://joaodavidsilva.com/knowledge/token-budget/'), html);
      const md = site.read(twin);
      for (const field of ['title', 'summary', 'published', 'updated', 'tags', 'language', 'canonical']) {
        assert.match(md, new RegExp(`^---\\n(?:[^]*\\n)?${field}: [^]*\\n---\\n`), `${twin} lacks ${field}`);
      }
    }
    const llms = site.read('llms.txt');
    assert.ok(llms.includes('(https://joaodavidsilva.com/knowledge.md)'), llms);
    assert.ok(llms.includes('(https://joaodavidsilva.com/knowledge/tags/tokens.md)'), llms);
  });
});

test('Portuguese Knowledge keeps localized hero, counts, kinds and tag destinations', () => {
  const site = buildFixture('translated-site');
  assert.ok(site.ok, site.output);
  const index = site.read('pt/knowledge/index.html');
  assert.match(index, /Engenharia com e para agentes de IA\./);
  assert.match(index, /Conceitos e Guias, por categoria\./);
  assert.match(index, /1 entrada em 1 categoria/);
  assert.match(index, /<span>Pesquisar na Base de Conhecimento<\/span>/);
  assert.match(index, /placeholder="contexto, sessão, ferramenta…"/);
  assert.match(index, /href="\/pt\/knowledge\/tags\/fichas\/">#fichas<\/a>/);
  assert.match(site.read('pt/knowledge/k1/index.html'), /data-pagefind-meta="kind">Conceito<\/span>/);
});

test('an empty Knowledge Base says so and offers no search', () => {
  const site = buildFixture('basic');
  assert.ok(site.ok, site.output);
  const index = site.read('knowledge/index.html');
  assert.match(index, /No Knowledge entries yet\./);
  assert.doesNotMatch(index, /role="search"/);
  assert.doesNotMatch(index, /data-knowledge-search/);
});

test('two Knowledge tags sharing one URL fail the build, naming both', () => {
  const site = buildFixture('knowledge-tag-collision');
  assert.equal(site.ok, false);
  assert.match(site.output, /"C\+\+"/);
  assert.match(site.output, /"C"/);
  assert.match(site.output, /cpp\.md/);
  assert.match(site.output, /c\.md/);
  assert.match(site.output, /\/knowledge\/tags\/c\//);
});

test('a Knowledge tag with no URL slug fails the build', () => {
  const site = buildFixture('knowledge-tag-unsluggable');
  assert.equal(site.ok, false);
  assert.match(site.output, /kana\.md: tag "日本語" has no URL/);
});

test('an unknown Knowledge front-matter field fails the build', () => {
  const site = buildFixture('knowledge-unknown-field');
  assert.equal(site.ok, false);
  assert.match(site.output, /term\.md/);
  assert.match(site.output, /tag/);
});

test('an unknown category fails the build', () => {
  const site = buildFixture('knowledge-unknown-category');
  assert.equal(site.ok, false);
  assert.match(site.output, /stray\.md/);
  assert.match(site.output, /category/);
});

test('a Guide referencing a Skill absent from the skills repo fails the build', () => {
  const site = buildFixture('knowledge-missing-skill');
  assert.equal(site.ok, false);
  assert.match(site.output, /orphan-guide\.md: skill "no-such-skill" not found in the skills repo/);
});

test('a broken Concept cross-reference fails the build', () => {
  const site = buildFixture('knowledge-broken-ref');
  assert.equal(site.ok, false);
  assert.match(site.output, /dangling\.md: related entry "nowhere" does not exist/);
});
