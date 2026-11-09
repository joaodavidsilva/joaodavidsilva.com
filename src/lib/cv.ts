import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { ABOUT_PATH, absoluteUrl, hrefOf, paragraphsOf, periodOf, type Record, type Source } from './record';

// The CV: one document from the full Professional record, never tailored. The PDF and the
// DOCX render the same model, so they carry the same prose and Claims as the About page.

/** A piece of text, linked when it is a URL. */
interface Span {
  text: string;
  url?: string;
}

/** One Claim, followed by where a reader can check it. */
interface Entry {
  text: string;
  label: 'Source' | 'Attested' | 'Demonstrated in';
  evidence: Span[];
}

/** A section is João's own prose (opinions, not Claims) or a list of Claims. */
interface Section {
  title: string;
  paragraphs: string[];
  entries: Entry[];
}

interface Cv {
  name: string;
  headline: string;
  /** Contact lines: email and site, then profiles elsewhere. */
  contact: Span[][];
  sections: Section[];
  colophon: string;
}

const link = (href: string): Span => ({ text: absoluteUrl(href), url: absoluteUrl(href) });

// Attested Claims are labelled: their evidence is private and only João can confirm it.
const sourced = (text: string, source: Source): Entry =>
  'attested' in source
    ? { text, label: 'Attested', evidence: [{ text: source.attested }] }
    : { text, label: 'Source', evidence: [link(hrefOf(source))] };

function cvOf(record: Record): Cv {
  const prose = (title: string, text: string | undefined) => ({ title, paragraphs: paragraphsOf(text), entries: [] });
  const claims = (title: string, entries: Entry[]) => ({ title, paragraphs: [], entries });
  const sections: Section[] = [
    prose('Interests', record.interests),
    prose('Approach to engineering', record.approach),
    claims('Roles', record.roles.map((r) => sourced(`${r.title}, ${r.organisation}, ${periodOf(r)}`, r.source))),
    claims('Projects', record.projects.map((p) => sourced(`${p.name}: ${p.summary}`, p.source))),
    claims(
      'Skills',
      record.skills.map((s): Entry => ({
        text: s.name,
        label: 'Demonstrated in',
        evidence: s.demonstrated.map((d) => link(hrefOf(d))),
      })),
    ),
    claims('Achievements', record.achievements.map((a) => sourced(a.text, a.source))),
    claims('Publications', record.publications.map((p) => sourced(p.title, p.source))),
    claims('Open-source contributions', record.contributions.map((c) => sourced(c.text, c.source))),
  ].filter((section) => section.paragraphs.length || section.entries.length);
  return {
    name: record.name,
    headline: record.headline,
    contact: [
      [...(record.email ? [{ text: record.email, url: `mailto:${record.email}` }] : []), { text: record.url, url: record.url }],
      record.sameAs.map((url) => ({ text: url, url })),
    ].filter((line) => line.length),
    sections,
    colophon:
      `Generated from the Professional record published at ${absoluteUrl(ABOUT_PATH)}. ` +
      `Every Claim names where it can be checked; attested Claims rest on private evidence that only ${record.name} can confirm.`,
  };
}

/** Spans with `separator` between them, as one run of text. */
const joined = (spans: Span[], separator: string): Span[] =>
  spans.flatMap((span, i) => (i ? [{ text: separator }, span] : [span]));

// ---- PDF -------------------------------------------------------------------

// Source Serif 4, the site's text face, as static OpenType files (SIL OFL, see cv-fonts/LICENSE.md).
// Paths are relative to the project root, where the build runs.
const font = (style: 'Regular' | 'Semibold' | 'It') => readFileSync(`src/lib/cv-fonts/SourceSerif4-${style}.otf`);
const INK = '#1a1a1a';
const MUTED = '#555555';

/** The CV as a PDF. */
export function cvPdf(record: Record): Promise<Uint8Array> {
  const cv = cvOf(record);
  const doc = new PDFDocument({
    size: 'A4',
    margin: 56,
    font: font('Regular'),
    lang: 'en',
    displayTitle: true,
    info: { Title: `${cv.name}: CV`, Author: cv.name, Subject: cv.headline },
  });
  doc.registerFont('regular', font('Regular'));
  doc.registerFont('semibold', font('Semibold'));
  doc.registerFont('italic', font('It'));

  const chunks: Buffer[] = [];
  const { promise, resolve, reject } = Promise.withResolvers<Uint8Array>();
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  /** Text runs on one flowing paragraph; URLs become links. */
  const runs = (spans: (Span & { font?: string })[], size: number, color: string) => {
    doc.fontSize(size).fillColor(color);
    spans.forEach((span, i) => {
      doc.font(span.font ?? 'regular').text(span.text, {
        continued: i < spans.length - 1,
        link: span.url ?? null,
        underline: false,
      });
    });
  };

  doc.font('semibold').fontSize(22).fillColor(INK).text(cv.name);
  doc.font('regular').fontSize(12).text(cv.headline);
  doc.moveDown(0.3);
  for (const line of cv.contact) runs(joined(line, '  ·  '), 9.5, MUTED);

  for (const section of cv.sections) {
    doc.moveDown(1.2);
    doc.font('semibold').fontSize(13).fillColor(INK).text(section.title);
    const y = doc.y + 2;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).lineWidth(0.5).strokeColor(MUTED).stroke();
    doc.moveDown(0.5);
    for (const paragraph of section.paragraphs) {
      doc.font('regular').fontSize(10.5).fillColor(INK).text(paragraph);
      doc.moveDown(0.5);
    }
    for (const entry of section.entries) {
      doc.font('regular').fontSize(10.5).fillColor(INK).text(entry.text);
      runs([{ text: `${entry.label}: `, font: 'italic' }, ...joined(entry.evidence, ', ')], 9, MUTED);
      doc.moveDown(0.5);
    }
  }

  doc.moveDown(1);
  doc.font('italic').fontSize(8.5).fillColor(MUTED).text(cv.colophon);
  doc.end();
  return promise;
}

// ---- DOCX ------------------------------------------------------------------

// Word documents name a font rather than embed one; Georgia is on every Windows and Mac install.
const DOCX_FONT = 'Georgia';
const MUTED_HEX = MUTED.slice(1);

const docxRuns = (spans: Span[], options: { size: number; italics?: boolean; color?: string }) =>
  spans.map((span) => {
    const run = new TextRun({ text: span.text, ...options });
    return span.url ? new ExternalHyperlink({ link: span.url, children: [run] }) : run;
  });

/** The CV as a DOCX. */
export async function cvDocx(record: Record): Promise<Uint8Array> {
  const cv = cvOf(record);
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(cv.name)] }),
    new Paragraph({ children: [new TextRun({ text: cv.headline, size: 24 })] }),
    ...cv.contact.map(
      (line, i) =>
        new Paragraph({
          spacing: { after: i === cv.contact.length - 1 ? 240 : 0 },
          children: docxRuns(joined(line, '  ·  '), { size: 19, color: MUTED_HEX }),
        }),
    ),
    ...cv.sections.flatMap((section) => [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(section.title)] }),
      ...section.paragraphs.map(
        (paragraph) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: paragraph, size: 21 })] }),
      ),
      // The Claim and its evidence as two paragraphs kept together, so text extractors keep them apart.
      ...section.entries.flatMap((entry) => [
        new Paragraph({ keepNext: true, children: [new TextRun({ text: entry.text, size: 21 })] }),
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: `${entry.label}: `, size: 18, italics: true, color: MUTED_HEX }),
            ...docxRuns(joined(entry.evidence, ', '), { size: 18, color: MUTED_HEX }),
          ],
        }),
      ]),
    ]),
    new Paragraph({
      spacing: { before: 240 },
      children: [new TextRun({ text: cv.colophon, size: 17, italics: true, color: MUTED_HEX })],
    }),
  ];
  const doc = new Document({
    creator: cv.name,
    title: `${cv.name}: CV`,
    description: cv.headline,
    styles: {
      default: {
        document: { run: { font: DOCX_FONT, color: INK.slice(1) } },
        title: { run: { font: DOCX_FONT, size: 44, bold: true, color: INK.slice(1) } },
        heading1: {
          run: { font: DOCX_FONT, size: 26, bold: true, color: INK.slice(1) },
          paragraph: { spacing: { before: 280, after: 120 } },
        },
      },
    },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
