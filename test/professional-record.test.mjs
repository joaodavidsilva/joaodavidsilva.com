import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixture, buildSite } from './build.mjs';

const personOf = (html) =>
  JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);

test('the About page and Person JSON-LD are generated from the Professional record', async (t) => {
  const site = buildFixture('record');
  assert.ok(site.ok, site.output);
  const html = site.read('about/index.html');
  const md = site.read('about.md');
  const ld = personOf(html);

  await t.test('every section renders with its source', () => {
    for (const text of [
      'Staff Fixture Engineer', 'Fixture Corp', 'Fixture App', 'Fixture Testing',
      'Won the fixture prize.', 'On fixtures', 'Fixed a bug in a fixture library.',
    ]) {
      assert.ok(html.includes(text), `HTML missing ${text}`);
      assert.ok(md.includes(text), `twin missing ${text}`);
    }
    assert.match(html, /href="https:\/\/example\.com\/on-fixtures"/);
    assert.match(html, /href="\/hello\/"/);
    assert.match(md, /\(https:\/\/example\.com\/on-fixtures\)/);
  });

  await t.test('attested Claims are labelled as attested', () => {
    assert.match(html, /class="attested"[^>]*>Attested<\/[a-z]+>[^<]*Award letter, kept by João/);
    assert.match(md, /Won the fixture prize\. \(Attested: Award letter, kept by João\)/);
  });

  await t.test('skills point to where they were demonstrated', () => {
    assert.match(html, /Fixture Testing[\s\S]*?href="https:\/\/github\.com\/fixture\/tests"/);
  });

  await t.test('Person JSON-LD agrees with the record', () => {
    assert.equal(ld['@type'], 'Person');
    assert.equal(ld.name, 'Fixture Person');
    assert.equal(ld.url, 'https://joaodavidsilva.com/');
    assert.equal(ld.email, 'mailto:fixture@example.com');
    assert.deepEqual(ld.sameAs, ['https://github.com/fixture']);
    assert.equal(ld.jobTitle, 'Staff Fixture Engineer');
    assert.deepEqual(ld.worksFor, { '@type': 'Organization', name: 'Fixture Corp' });
    assert.deepEqual(ld.alumniOf, undefined);
    assert.deepEqual(ld.knowsAbout, ['Fixture Testing']);
    assert.deepEqual(ld.award, ['Won the fixture prize.']);
    assert.equal(ld.telephone, undefined);
    assert.equal(ld.address, undefined);
  });

  await t.test('llms.txt lists the About page', () => {
    assert.match(site.read('llms.txt'), /- \[About\]\(https:\/\/joaodavidsilva\.com\/about\.md\)/);
  });
});

test('a Claim without a source fails the build', () => {
  const site = buildFixture('record-unsourced');
  assert.equal(site.ok, false);
  assert.match(site.output, /record\.yaml/);
  assert.match(site.output, /publications/);
});

test('a skill with no demonstration reference fails the build', () => {
  const site = buildFixture('record-undemonstrated');
  assert.equal(site.ok, false);
  assert.match(site.output, /demonstrated/);
});

test('a source pointing at a page that does not exist fails the build', () => {
  const site = buildFixture('record-broken-page');
  assert.equal(site.ok, false);
  assert.match(site.output, /\/missing\//);
});

test('the record refuses phone numbers and postal addresses', async (t) => {
  await t.test('as a field', () => {
    const site = buildFixture('record-phone');
    assert.equal(site.ok, false);
    assert.match(site.output, /phone/);
  });
  await t.test('inside a Claim', () => {
    const site = buildFixture('record-phone-in-text');
    assert.equal(site.ok, false);
    assert.match(site.output, /phone number/i);
  });
});

test("João's Professional record builds into the About page", () => {
  const record = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'record.yaml'), 'utf8');
  assert.doesNotMatch(record.replace(/^\s*#.*$/gm, ''), /phone|telephone|address|street|postcode/i);
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const ld = personOf(site.read('about/index.html'));
  assert.equal(ld['@type'], 'Person');
  assert.equal(ld.name, 'João David Silva');
});
