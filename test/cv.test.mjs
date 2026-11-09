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
    // Reference numbers are superscripts: a PDF reader may or may not see a space before them.
    await t.test(`the ${format.toUpperCase()} carries every Claim, each with a reference number`, () => {
      for (const expected of [
        'Fixture Person',
        'Engineering beyond implementation.',
        'PROFILE Fixture interest paragraph one. Fixture interest paragraph two. Fixture approach paragraph.',
        /Staff Fixture Engineer ?1 attested Jan 2024 – present Fixture Corp/,
        /Junior Fixture Engineer ?2 Mar 2020 – Dec 2023 Old Corp •\s?Shipped the fixture app to both stores\. •\s?Cut fixture build times in half\./,
        /Fixture App ?3 An app that exists only in tests\./,
        /Second App ?4 example\.com\/second-app An app with its own site\./,
        /Fixture Testing ?5,6/,
        /Won the fixture prize\. ?7 attested/,
        /On fixtures ?8 example\.com\/on-fixtures-paper/,
        /Fixed a bug in a fixture library\. ?9/,
      ]) {
        assert.ok(typeof expected === 'string' ? text.includes(expected) : expected.test(text), `${format} missing ${expected} in: ${text}`);
      }
    });

    await t.test(`the ${format.toUpperCase()} lists every reference under Sources, as host and path`, () => {
      assert.ok(
        text.includes(
          'SOURCES 1 Attested — Employment contract, kept by João 2 example.com/old-corp-team ' +
            '3 joaodavidsilva.com/projects/fixture-app 4 example.com/second-app-launch 5 joaodavidsilva.com/hello ' +
            '6 github.com/fixture/tests 7 Attested — Award letter, kept by João 8 example.com/on-fixtures ' +
            '9 github.com/fixture/lib/pull/1',
        ),
        text,
      );
      assert.doesNotMatch(text, /Source:|Demonstrated in:/, 'no per-Claim source line');
      assert.doesNotMatch(text, /https?:\/\//, 'links read as host and path, never raw URLs');
    });

    await t.test(`the ${format.toUpperCase()} contact is the site, LinkedIn and the email, as host and path`, () => {
      assert.ok(text.includes('Lisbon, Portugal · joaodavidsilva.com · linkedin.com/in/fixture · fixture@joaodavidsilva.com'), text);
      assert.ok(text.includes('LANGUAGES Portuguese (native) · English (fluent)'), text);
      assert.doesNotMatch(text, /github\.com\/fixture(?![\/\w])/);
    });

    await t.test(`the ${format.toUpperCase()} marks attested Claims and explains them once`, () => {
      assert.equal(text.match(/\battested\b/g).length, 2, 'only attested Claims carry the marker');
      assert.equal(text.match(/Attested — /g).length, 2, 'attested Claims cite their private evidence under Sources');
      assert.match(text, /9 github\.com\/fixture\/lib\/pull\/1 Attested Claims rest on private evidence that only Fixture Person can confirm\./);
    });
  }

  await t.test('every PDF page carries the footer with the About page, the build date and the page number', async () => {
    const pages = await pdfPages(site.bytes('cv.pdf'));
    pages.forEach((page, i) => {
      assert.match(page, /joaodavidsilva\.com\/about · generated \d{1,2} [A-Z][a-z]+ \d{4}/, `page ${i + 1}: ${page}`);
      assert.ok(page.includes(`${i + 1} / ${pages.length}`), `page ${i + 1}: ${page}`);
    });
  });

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
    for (const expected of ['João David Silva', 'dotore', 'AI Skills', 'BrightBoi', 'Markdown Exporter', 'Lozza', 'Facts Memorizer']) {
      assert.ok(text.includes(expected), `${format} missing "${expected}": ${text}`);
    }
  }
});
