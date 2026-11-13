import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildContent, buildFixture, buildSite } from './build.mjs';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** Each page's text as a PDF reader sees it, whitespace collapsed. */
async function pdfPages(bytes) {
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' '));
  }
  return pages;
}

/** The CV's text as a PDF reader sees it, whitespace collapsed, without the footer that repeats on every page. */
const pdfText = async (bytes) =>
  (await pdfPages(bytes)).map((page) => page.replace(/ joaodavidsilva\.com\/about · generated .*$/, '')).join(' ');

test('the build emits the CV as a PDF from the Professional record', async (t) => {
  const site = buildFixture('record');
  assert.ok(site.ok, site.output);
  assert.equal(site.bytes('cv.pdf').subarray(0, 5).toString(), '%PDF-');
  assert.equal(site.has('cv.docx'), false, 'the CV is published as a PDF only');
  const text = await pdfText(site.bytes('cv.pdf'));

  await t.test('it carries every Claim and the notes about where the full detail lives', () => {
    for (const expected of [
      'Fixture Person',
      'Engineering beyond implementation.',
      'PROFILE Fixture interest paragraph one. Fixture interest paragraph two. Fixture approach paragraph.',
      /Staff Fixture Engineer · Fixture Corp Jan 2024 – present/,
      /Junior Fixture Engineer · Old Corp Mar 2020 – Dec 2023 Fixture Script · Mock Cloud •\s?Shipped the fixture app to both stores\. •\s?Cut fixture build times in half\./,
      'Every role in full: joaodavidsilva.com/about and linkedin.com/in/fixture',
      /PROJECTS Fixture App An app that exists only in tests\./,
      /Second App example\.com\/second-app An app with its own site\./,
      /Fixture Testing/,
      /Won the fixture prize\./,
      /On fixtures example\.com\/on-fixtures-paper/,
      /Fixed a bug in a fixture library\./,
    ]) {
      assert.ok(typeof expected === 'string' ? text.includes(expected) : expected.test(text), `missing ${expected} in: ${text}`);
    }
  });

  await t.test('it shows older roles by title and period only', () => {
    assert.match(text, /Intern Fixture Engineer · Ancient Corp Jan 2015 – Jun 2015/);
    assert.doesNotMatch(text, /Ancient highlight/);
  });

  await t.test('it has no Sources list, numbers or attested marks', () => {
    assert.doesNotMatch(text, /SOURCES|Attested|attested|Source:|Demonstrated in:/);
    assert.doesNotMatch(text, /https?:\/\//, 'links read as host and path, never raw URLs');
  });

  await t.test('the contact is the site, LinkedIn and the email, then the languages', () => {
    assert.ok(
      text.includes('Lisbon, Portugal · joaodavidsilva.com · linkedin.com/in/fixture · fixture@joaodavidsilva.com Portuguese (native) · English (fluent)'),
      text,
    );
    assert.doesNotMatch(text, /LANGUAGES/);
    assert.doesNotMatch(text, /github\.com\/fixture(?![\/\w])/);
  });

  await t.test('every page carries the footer with the About page, the build date and the page number', async () => {
    const pages = await pdfPages(site.bytes('cv.pdf'));
    pages.forEach((page, i) => {
      assert.match(page, /joaodavidsilva\.com\/about · generated \d{1,2} [A-Z][a-z]+ \d{4}/, `page ${i + 1}: ${page}`);
      assert.ok(page.includes(`${i + 1} / ${pages.length}`), `page ${i + 1}: ${page}`);
    });
  });

  await t.test('the About page offers the PDF for download', () => {
    const html = site.read('about/index.html');
    assert.match(html, /<a[^>]*href="\/cv\.pdf"[^>]*>CV · PDF<\/a>/);
    assert.doesNotMatch(html, /docx/i);
    const md = site.read('about.md');
    assert.ok(md.includes('[PDF](https://joaodavidsilva.com/cv.pdf)'), md);
    assert.doesNotMatch(md, /docx/i);
  });
});

test('changing the record changes the CV on the next build', async () => {
  const content = mkdtempSync(join(tmpdir(), 'jds-cv-content-'));
  cpSync(join(fixtures, 'record'), content, { recursive: true });
  const record = join(content, 'record.yaml');
  writeFileSync(record, readFileSync(record, 'utf8').replace('Won the fixture prize.', 'Won the revised prize.'));

  const site = buildContent('cv-revised', content);
  assert.ok(site.ok, site.output);
  const text = await pdfText(site.bytes('cv.pdf'));
  assert.ok(text.includes('Won the revised prize.'), text);
  assert.ok(!text.includes('Won the fixture prize.'), 'the CV still has the old Claim');
});

test("João's CV is built from his Professional record", async () => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const text = await pdfText(site.bytes('cv.pdf'));
  for (const expected of ['João David Silva', 'dotore', 'AI Skills', 'BrightBoi', 'Markdown Exporter', 'Facts Memorizer']) {
    assert.ok(text.includes(expected), `missing "${expected}": ${text}`);
  }
  // LinkedIn is not cited on the CV, so roles carry no reference number.
  assert.match(text, /ROLES AI Mobile Developer · EDP Oct 2025 – present/, text);
});
