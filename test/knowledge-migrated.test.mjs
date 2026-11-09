import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSite } from './build.mjs';

// The first batch migrated from the skills repo's docs/references (ticket #24, ADR-0002).
const BATCH = {
  agent: 'AI Engineering',
  model: 'AI Engineering',
  token: 'AI Engineering',
  context: 'Context Engineering',
  'context-window': 'Context Engineering',
  session: 'Context Engineering',
  'smart-zone': 'Context Engineering',
  compaction: 'Context Engineering',
  clearing: 'Context Engineering',
  harness: 'Harness Engineering',
  turn: 'Harness Engineering',
  tool: 'MCP & Tooling',
  'tool-call': 'MCP & Tooling',
};

const SKILLS_DOCS = 'https://github.com/joaodavidsilva/skills/blob/main/docs/references/';

test('the first migrated Knowledge Base batch is published', async (t) => {
  const site = buildSite();
  assert.ok(site.ok, site.output);

  await t.test('as Concepts with their category and tags', () => {
    for (const [id, category] of Object.entries(BATCH)) {
      const md = site.read(`knowledge/${id}.md`);
      assert.ok(md.includes('\nkind: concept\n'), `${id} is a Concept`);
      assert.ok(md.includes(`\ncategory: ${JSON.stringify(category)}\n`), `${id} is in ${category}`);
      assert.doesNotMatch(md, /\ntags: \[\]\n/, `${id} has tags`);
      const html = site.read(`knowledge/${id}/index.html`);
      assert.ok(html.includes(`>${category.replace('&', '&amp;')}</a>`), `${id} page names its category`);
    }
  });

  await t.test('with cross-references rewritten to working site URLs', () => {
    for (const id of Object.keys(BATCH)) {
      const md = site.read(`knowledge/${id}.md`);
      assert.doesNotMatch(md, /\]\(\.{1,2}\//, `${id} keeps no relative skills-repo link`);
      for (const [, path] of md.matchAll(/\]\((\/knowledge\/[^)#]*)\)/g)) {
        assert.ok(site.has(`${path}index.html`), `${id} links to ${path}, which is not published`);
      }
    }
  });

  await t.test('without pointing at the skills repo copy of a migrated entry', () => {
    for (const id of Object.keys(BATCH)) {
      const md = site.read(`knowledge/${id}.md`);
      for (const [, slug] of md.matchAll(new RegExp(`${SKILLS_DOCS}([a-z0-9-]+)\\.md`, 'g'))) {
        assert.ok(!site.has(`knowledge/${slug}/index.html`), `${id} links to the skills repo copy of ${slug}`);
      }
    }
  });
});
