import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import { buildContent, buildFixture, buildSite } from './build.mjs';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** The CV's text as a PDF reader sees it, whitespace collapsed. */
async function pdfText(bytes) {
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages.join(' ').replace(/\s+/g, ' ');
}

/** The CV's text as a DOCX reader sees it, whitespace collapsed. */
async function docxText(bytes) {
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return value.replace(/\s+/g, ' ');
}

/** Both CV files' text, keyed by format. */
async function cvsOf(site) {
  return {
    pdf: await pdfText(site.bytes('cv.pdf')),
    docx: await docxText(site.bytes('cv.docx')),
  };
}

test('the build emits the CV in PDF and DOCX from the Professional record', async (t) => {
  const site = buildFixture('record');
  assert.ok(site.ok, site.output);

  await t.test('both files are real PDF and DOCX documents', () => {
    assert.equal(site.bytes('cv.pdf').subarray(0, 5).toString(), '%PDF-');
    assert.equal(site.bytes('cv.docx').subarray(0, 2).toString(), 'PK');
  });

  const cvs = await cvsOf(site);

  for (const [format, text] of Object.entries(cvs)) {
    await t.test(`the ${format.toUpperCase()} carries every Claim with its source`, () => {
      for (const expected of [
        'Fixture Person',
        'Engineering beyond implementation.',
        'fixture@joaodavidsilva.com',
        'https://joaodavidsilva.com/',
        'https://www.linkedin.com/in/fixture/',
        'Interests Fixture interest paragraph one. Fixture interest paragraph two.',
        'Approach to engineering Fixture approach paragraph.',
        'Staff Fixture Engineer, Fixture Corp, Jan 2024 – present',
        'Junior Fixture Engineer, Old Corp, Mar 2020 – Dec 2023 Source: https://example.com/old-corp-team',
        'Fixture App: An app that exists only in tests. Source: https://joaodavidsilva.com/projects/fixture-app/',
        'Fixture Testing Demonstrated in: https://joaodavidsilva.com/hello/, https://github.com/fixture/tests',
        'On fixtures Source: https://example.com/on-fixtures',
        'Fixed a bug in a fixture library. Source: https://github.com/fixture/lib/pull/1',
      ]) {
        assert.ok(text.includes(expected), `${format} missing "${expected}" in: ${text}`);
      }
    });

    await t.test(`the ${format.toUpperCase()} contact is limited to the email, the site and LinkedIn`, () => {
      assert.doesNotMatch(text, /https:\/\/github\.com\/fixture(?![\/\w])/);
    });

    await t.test(`the ${format.toUpperCase()} labels attested Claims`, () => {
      assert.ok(text.includes('Won the fixture prize. Attested: Award letter, kept by João'), text);
      assert.ok(text.includes('Jan 2024 – present Attested: Employment contract, kept by João'), text);
      assert.equal(text.match(/Attested:/g).length, 2, 'only attested Claims carry the label');
    });
  }

  await t.test('the About page offers both files for download', () => {
    const html = site.read('about/index.html');
    assert.match(html, /<a href="\/cv\.pdf"[^>]*>PDF<\/a>/);
    assert.match(html, /<a href="\/cv\.docx"[^>]*>DOCX<\/a>/);
    const md = site.read('about.md');
    assert.ok(md.includes('[PDF](https://joaodavidsilva.com/cv.pdf)'), md);
    assert.ok(md.includes('[DOCX](https://joaodavidsilva.com/cv.docx)'), md);
  });
});

test('changing the record changes the CV on the next build', async () => {
  const content = mkdtempSync(join(tmpdir(), 'jds-cv-content-'));
  cpSync(join(fixtures, 'record'), content, { recursive: true });
  const record = join(content, 'record.yaml');
  writeFileSync(record, readFileSync(record, 'utf8').replace('Won the fixture prize.', 'Won the revised prize.'));

  const site = buildContent('cv-revised', content);
  assert.ok(site.ok, site.output);
  for (const [format, text] of Object.entries(await cvsOf(site))) {
    assert.ok(text.includes('Won the revised prize.'), `${format}: ${text}`);
    assert.ok(!text.includes('Won the fixture prize.'), `${format} still has the old Claim`);
  }
});

test("João's CV is built from his Professional record", async () => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  for (const [format, text] of Object.entries(await cvsOf(site))) {
    assert.ok(text.includes('João David Silva'), `${format}: ${text}`);
    assert.ok(text.includes('Facts Memorizer'), `${format}: ${text}`);
  }
});
