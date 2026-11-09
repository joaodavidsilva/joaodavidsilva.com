import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture } from './build.mjs';

const SKILLS = 'https://github.com/joaodavidsilva/skills/blob/main';

test('Knowledge Base entries are published', async (t) => {
  const site = buildFixture('knowledge');
  assert.ok(site.ok, site.output);
  const concept = site.read('knowledge/context-window/index.html');
  const guide = site.read('knowledge/writing-tests-first/index.html');

  await t.test('entries render under the agent-readability contract', () => {
    assert.match(concept, /<h1>Context window<\/h1>/);
    assert.match(concept, /The context window body paragraph\./);
    assert.doesNotMatch(concept, /<script(?![^>]*application\/ld\+json)/);
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
    assert.match(md, /The context window body paragraph\./);
    assert.match(
      site.read('llms.txt'),
      /- \[Context window\]\(https:\/\/joaodavidsilva\.com\/knowledge\/context-window\.md\): The tokens a model can attend to at once\./,
    );
  });

  await t.test('entries show when they were last updated', () => {
    assert.match(concept, /Last updated <time datetime="\d{4}-\d{2}-\d{2}">/);
  });

  await t.test('Concept cross-references resolve to the related Concept', () => {
    assert.match(concept, /<a href="\/knowledge\/token-budget\/">Token budget<\/a>/);
  });

  await t.test('a Guide with a valid Skill links to its SKILL.md', () => {
    assert.ok(guide.includes(`href="${SKILLS}/skills/engineering/tdd/SKILL.md"`));
    assert.ok(site.read('knowledge/writing-tests-first.md').includes(`\nskill: ${SKILLS}/skills/engineering/tdd/SKILL.md\n`));
  });

  await t.test('the index groups entries by category', () => {
    const index = site.read('knowledge/index.html');
    const ctx = index.indexOf('<h2 id="context-engineering">Context Engineering</h2>');
    const dev = index.indexOf('<h2 id="development-processes-methodologies">Development Processes &amp; Methodologies</h2>');
    assert.ok(ctx > -1 && dev > -1, index);
    const ctxSection = index.slice(ctx, dev);
    assert.match(ctxSection, /href="\/knowledge\/context-window\/"/);
    assert.match(ctxSection, /href="\/knowledge\/token-budget\/"/);
    assert.match(index.slice(dev), /href="\/knowledge\/writing-tests-first\/"/);
    assert.doesNotMatch(index, /AI Engineering<\/h2>/, 'empty categories are omitted');
    assert.match(site.read('knowledge.md'), /\[Context window\]\(\/knowledge\/context-window\/\)/);
  });

  await t.test('the index filters by tag', () => {
    assert.match(site.read('knowledge/index.html'), /href="\/knowledge\/tags\/tokens\/"/);
    const tokens = site.read('knowledge/tags/tokens/index.html');
    assert.match(tokens, /href="\/knowledge\/context-window\/"/);
    assert.match(tokens, /href="\/knowledge\/token-budget\/"/);
    assert.doesNotMatch(tokens, /href="\/knowledge\/writing-tests-first\/"/);
    assert.ok(site.has('knowledge/tags/tokens.md'));
  });
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
