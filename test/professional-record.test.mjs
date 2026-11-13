import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixture, buildSite } from './build.mjs';
import { stylesheetsOf } from './css.mjs';

const personOf = (html) =>
  JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
const textOf = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const cssOf = (site) => stylesheetsOf(site, site.read('about/index.html'));

test('the About page and Person JSON-LD are generated from the Professional record', async (t) => {
  const site = buildFixture('record');
  assert.ok(site.ok, site.output);
  const html = site.read('about/index.html');
  const md = site.read('about.md');
  const ld = personOf(html);

  await t.test('every section renders with its source', () => {
    for (const text of [
      'Staff Fixture Engineer', 'Fixture Corp', 'Fixture App', 'Fixture Testing', 'Grouped Testing',
      'Fixture BSc', 'Won the fixture prize.', 'On fixtures', 'Fixed a bug in a fixture library.',
    ]) {
      assert.ok(html.includes(text), `HTML missing ${text}`);
      assert.ok(md.includes(text), `twin missing ${text}`);
    }
    assert.match(html, /href="https:\/\/example\.com\/on-fixtures"/);
    assert.match(html, /href="\/hello\/"/);
    assert.match(md, /\(https:\/\/example\.com\/on-fixtures\)/);
  });

  await t.test('the hero and actions come from the record', () => {
    assert.match(html, /<h1[^>]*>Fixture Person<\/h1>/);
    assert.match(html, /Engineering beyond implementation\./);
    assert.match(textOf(html), /Lisbon, Portugal · Portuguese \(native\), English \(fluent\)/);
    assert.match(html, /<a[^>]*href="mailto:fixture@joaodavidsilva\.com"[^>]*>Contact<\/a>/);
    assert.match(html, /<a[^>]*href="\/cv\.pdf"[^>]*download="fixture-person-cv\.pdf"[^>]*>CV · PDF<\/a>/);
    assert.doesNotMatch(html, /cv\.docx|DOCX/);
  });

  await t.test('stats are derived from role history and the attested usage claim', () => {
    const now = new Date();
    const years = now.getUTCFullYear() - 2015 - (now.getUTCMonth() + 1 < 1 ? 1 : 0);
    assert.match(html, new RegExp(`<dd>${years}</dd><dt>years of mobile and front-end engineering</dt>`));
    assert.match(html, /<dd>3<\/dd><dt>roles, all listed below<\/dt>/);
    assert.match(html, /<dd>1,200\+<\/dd><dt>active EDP colleagues on Mind4EDP Mobile<\/dt>/);
    assert.match(md, /1,200\+ active EDP colleagues on Mind4EDP Mobile/);
  });

  await t.test("João's interests and approach render as his own prose", () => {
    assert.match(html, /<h2[^>]*>Interests<\/h2>[\s\S]*?<p>Fixture interest paragraph one\.<\/p>\s*<p>Fixture interest paragraph two\.<\/p>/);
    assert.match(html, /<h2[^>]*>Approach to engineering<\/h2>[\s\S]*?<p>Fixture approach paragraph\.<\/p>/);
    assert.match(md, /## Interests\n\nFixture interest paragraph one\.\n\nFixture interest paragraph two\.\n/);
    assert.match(md, /## Approach to engineering\n\nFixture approach paragraph\.\n/);
  });

  await t.test('attested Claims carry a badge and never a public source link', () => {
    assert.match(html, /Supported more than 1,200 fixture users\. <span class="attested-badge">Attested<\/span>/);
    const claim = html.match(/<li>Supported more than 1,200 fixture users\.[\s\S]*?<\/li>/)[0];
    assert.doesNotMatch(claim, /<a /);
    assert.match(html, /Won the fixture prize\. <span class="attested-badge">Attested<\/span>/);
    assert.match(md, /Won the fixture prize\. \(Attested: Award letter, kept by João\)/);
  });

  await t.test('grouped skills point to where each skill was demonstrated', () => {
    assert.match(html, /<h3>Engineering<\/h3>[\s\S]*?Grouped Testing[\s\S]*?href="\/hello\/"[\s\S]*?href="https:\/\/github\.com\/fixture\/tests"/);
    assert.match(html, /Fixture Testing[\s\S]*?href="https:\/\/github\.com\/fixture\/tests"/);
    assert.match(md, /## Skills[\s\S]*?### Engineering[\s\S]*?Grouped Testing/);
  });

  await t.test('education preserves future status and sources', () => {
    assert.match(html, /Self-taught fixture engineer/);
    assert.match(html, /Fixture BSc, Example University — starting 2028/);
    assert.match(md, /## Education[\s\S]*?starting 2028/);
    assert.deepEqual(ld.alumniOf, undefined);
  });

  await t.test('Person JSON-LD agrees with the record', () => {
    assert.equal(ld['@type'], 'Person');
    assert.equal(ld.name, 'Fixture Person');
    assert.equal(ld.url, 'https://joaodavidsilva.com/');
    assert.equal(ld.email, 'mailto:fixture@joaodavidsilva.com');
    assert.deepEqual(ld.sameAs, ['https://github.com/fixture', 'https://www.linkedin.com/in/fixture/']);
    assert.equal(ld.jobTitle, 'Staff Fixture Engineer');
    assert.deepEqual(ld.worksFor, { '@type': 'Organization', name: 'Fixture Corp' });
    assert.deepEqual(ld.knowsAbout, ['Fixture Testing', 'Grouped Testing']);
    assert.deepEqual(ld.award, ['Won the fixture prize.']);
    assert.equal(ld.telephone, undefined);
    assert.equal(ld.address, undefined);
  });

  await t.test('a Claim can be sourced to a Project page', () => {
    assert.match(html, /Fixture App[\s\S]*?<a href="\/projects\/fixture-app\/"[^>]*>source<\/a>/);
  });

  await t.test('a Project and a Publication link to their own URL when the record gives one', () => {
    assert.match(html, /<a href="https:\/\/example\.com\/second-app">Second App<\/a>/);
    assert.match(html, /<a href="https:\/\/example\.com\/on-fixtures-paper">On fixtures<\/a>/);
  });

  await t.test('demonstrations and profiles read as page titles or host and path, never raw URLs', () => {
    assert.match(html, /<a href="\/hello\/">Hello fixture<\/a>/);
    assert.match(html, /<a href="https:\/\/github\.com\/fixture\/tests">github\.com\/fixture\/tests<\/a>/);
    assert.match(html, /<a href="https:\/\/www\.linkedin\.com\/in\/fixture\/" rel="me">linkedin\.com\/in\/fixture<\/a>/);
  });

  await t.test('roles show full periods, stacks, highlights and sources', () => {
    assert.match(html, /Jan 2024 – present/);
    assert.match(html, /Mar 2020 – Dec 2023/);
    assert.doesNotMatch(html, /2024-01|2020-03/);
    assert.match(html, /Stack: Fixture Script · Mock Cloud/);
    assert.match(html, /Shipped the fixture app to both stores\./);
    assert.match(html, /href="https:\/\/example\.com\/old-corp-team"/);
  });

  await t.test('the responsive About CSS is emitted', () => {
    const css = cssOf(site);
    assert.match(css, /\.record-role/);
    assert.match(css, /@media\s*\(width<=640px\)/);
    assert.match(css, /overflow-wrap:\s*anywhere/);
  });

  await t.test('the twin carries the shared front-matter', () => {
    assert.match(md, /\nupdated: \d{4}-\d{2}-\d{2}\n/);
    assert.ok(md.includes('\ntags: []\n'), md);
  });

  await t.test('llms.txt lists the About page', () => {
    assert.match(site.read('llms.txt'), /- \[About\]\(https:\/\/joaodavidsilva\.com\/about\.md\)/);
  });
});

test('empty prose sections are omitted', () => {
  const site = buildFixture('record-no-prose');
  assert.ok(site.ok, site.output);
  assert.doesNotMatch(site.read('about/index.html'), /Interests|Approach to engineering/);
  assert.doesNotMatch(site.read('about.md'), /Interests|Approach to engineering/);
});

test('a Claim without a source fails the build', () => {
  const site = buildFixture('record-unsourced');
  assert.equal(site.ok, false);
  assert.match(site.output, /record\.yaml/);
  assert.match(site.output, /publications/);
});

test('Education without a source fails the build', () => {
  const site = buildFixture('record-unsourced-education');
  assert.equal(site.ok, false);
  assert.match(site.output, /education/);
  assert.match(site.output, /source/);
});

test('a skill with no demonstration reference fails the build', () => {
  const site = buildFixture('record-undemonstrated');
  assert.equal(site.ok, false);
  assert.match(site.output, /demonstrated/);
});

test('a grouped skill with no demonstration reference fails the build', () => {
  const site = buildFixture('record-undemonstrated-group');
  assert.equal(site.ok, false);
  assert.match(site.output, /skillGroups/);
  assert.match(site.output, /demonstrated/);
});

test('a source pointing at a page that does not exist fails the build', () => {
  const site = buildFixture('record-broken-page');
  assert.equal(site.ok, false);
  assert.match(site.output, /\/missing\//);
});

test('an email outside the site domain fails the build', () => {
  const site = buildFixture('record-foreign-email');
  assert.equal(site.ok, false);
  assert.match(site.output, /email/);
  assert.match(site.output, /joaodavidsilva\.com/);
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
  await t.test('as a location', () => {
    const site = buildFixture('record-address-location');
    assert.equal(site.ok, false);
    assert.match(site.output, /city and country/);
  });
});

test("João's Professional record builds into the complete About page", () => {
  const record = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'record.yaml'), 'utf8');
  assert.doesNotMatch(record.replace(/^\s*#.*$/gm, ''), /phone|telephone|address|street|postcode/i);
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const html = site.read('about/index.html');
  const md = site.read('about.md');
  const ld = personOf(html);
  assert.equal(ld['@type'], 'Person');
  assert.equal(ld.name, 'João David Silva');
  assert.equal((html.match(/class="record-role"/g) ?? []).length, 12);
  assert.match(html, /<dd>12<\/dd><dt>roles, all listed below<\/dt>/);
  assert.match(html, /<dd>13,000\+<\/dd>/);
  for (const text of [
    'Lead architect of Mind4EDP Mobile', 'built with a team', 'coding-agent harnesses',
    'Designed, developed and maintained the new LivePen mobile app', 'Customised the product',
    'Built responsive web interfaces in React and Next.js', 'Hired to build the new platform in React',
    'Started a mobile banking application', 'Developed a Xamarin mobile app for Sogenave',
    'BSc in Electronics Engineering, NOVA FCT — starting 2027', 'Lozza', 'Systems / Tooling',
  ]) {
    assert.ok(html.includes(text), `About missing ${text}`);
    assert.ok(md.includes(text), `Markdown twin missing ${text}`);
  }
  assert.doesNotMatch(html, /sole developer|Contributed to no-code mission software|cv\.docx|DOCX/);
  const usageClaim = html.match(/<li>Lead architect of Mind4EDP Mobile[\s\S]*?<\/li>/)[0];
  assert.match(usageClaim, /<span class="attested-badge">Attested<\/span>/);
  assert.doesNotMatch(usageClaim, /linkedin|source<\/a>/);
});
