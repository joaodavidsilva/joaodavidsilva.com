import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildContent } from './build.mjs';

const STUDY_BODY = ['Question', 'Hypothesis', 'Method', 'Observations', 'Findings', 'Limitations']
  .map((section) => `## ${section}\n\n${section} paragraph.\n`)
  .join('\n');

/** Builds a content set made of `files` ({ path: text }). */
function buildFiles(name, files) {
  const dir = mkdtempSync(join(tmpdir(), `jds-${name}-content-`));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return buildContent(name, dir);
}

test('an Article published after today fails the build', () => {
  const site = buildFiles('future-article', {
    'articles/later.md': '---\ntitle: Later\nsummary: Not yet.\npublished: 2999-01-01\n---\n\nSoon.\n',
  });
  assert.equal(site.ok, false);
  assert.match(site.output, /later\.md: published 2999-01-01 is after today/);
});

test('a Study published after today fails the build', () => {
  const site = buildFiles('future-study', {
    'studies/later.md': `---\ntitle: Later\nsummary: Not yet.\npublished: 2999-01-01\nstatus: in progress\n---\n\n${STUDY_BODY}`,
  });
  assert.equal(site.ok, false);
  assert.match(site.output, /later\.md: published 2999-01-01 is after today/);
});

test('a summary longer than 200 characters fails the build', () => {
  const site = buildFiles('long-summary', {
    'articles/wordy.md': `---\ntitle: Wordy\nsummary: ${'a'.repeat(201)}\npublished: 2026-01-01\n---\n\nBody.\n`,
  });
  assert.equal(site.ok, false);
  assert.match(site.output, /wordy\.md/);
  assert.match(site.output, /summary.*200 characters/s);
});

test("a Project's one-line description longer than 120 characters fails the build", () => {
  const site = buildFiles('long-one-line', {
    'projects/wordy.md': `---\nname: Wordy\noneLine: ${'a'.repeat(121)}\nstatus: active\npublished: 2026-01-01\n---\n\nBody.\n`,
  });
  assert.equal(site.ok, false);
  assert.match(site.output, /wordy\.md/);
  assert.match(site.output, /oneLine.*120 characters/s);
});

test('more than 8 tags on a piece fails the build', () => {
  const tags = Array.from({ length: 9 }, (_, i) => `tag${i}`).join(', ');
  const site = buildFiles('many-tags', {
    'articles/tagged.md': `---\ntitle: Tagged\nsummary: Many tags.\npublished: 2026-01-01\ntags: [${tags}]\n---\n\nBody.\n`,
  });
  assert.equal(site.ok, false);
  assert.match(site.output, /tagged\.md/);
  assert.match(site.output, /tags.*8 tags/s);
});

test('a summary of exactly 200 characters and 8 tags build', () => {
  const tags = Array.from({ length: 8 }, (_, i) => `tag${i}`).join(', ');
  const site = buildFiles('at-limits', {
    'articles/full.md': `---\ntitle: Full\nsummary: ${'a'.repeat(200)}\npublished: 2026-01-01\ntags: [${tags}]\n---\n\nBody.\n`,
  });
  assert.ok(site.ok, site.output);
});
