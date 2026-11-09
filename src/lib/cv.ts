import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import {
  BorderStyle, Document, ExternalHyperlink, Footer, Packer, PageNumber, Paragraph, TabStopType, TextRun, type IRunOptions,
  type ParagraphChild,
} from 'docx';
import {
  ABOUT_PATH, absoluteUrl, hostPath, hrefOf, paragraphsOf, periodOf, type ProfessionalRecord, type Source,
} from './record';
import { ORIGINAL_LANGUAGE } from './translations';
import { uiOf } from './ui';

// The CV: one document from the full Professional record, never tailored. The PDF and the
// DOCX render the same model, so they carry the same prose and Claims as the About page.
// Every Claim carries a reference number; the Sources section lists where each one can be
// checked, so a printed CV stays traceable without a source line under every Claim.

/** A piece of text, linked when it leads somewhere. */
interface Span {
  text: string;
  url?: string;
}

/** Where Claims can be checked, numbered in order of first citation. */
interface Reference {
  number: number;
  text: string;
  url?: string;
}

/** One Claim: its title links to its first source and carries its reference numbers. */
interface Entry {
  title: string;
  /** Names (roles, projects, publications) are set bold; sentences (achievements, contributions) are not. */
  named: boolean;
  url?: string;
  references: number[];
  attested: boolean;
  /** Right-aligned on the title line: a period, or the thing's own address. */
  meta?: Span;
  /** The line under the title: a role's organisation. */
  detail?: string;
  /** Body text: a project's summary. */
  body?: string;
  /** What was done: a role's highlights, one line each under the detail. */
  bullets?: string[];
}

/** A section is João's own prose (opinions, not Claims) or a list of Claims. */
interface Section {
  label: string;
  paragraphs: string[];
  entries: Entry[];
  /** Short Claims (skills) run on as one paragraph instead of one per line. */
  runOn?: boolean;
}

interface Cv {
  name: string;
  headline: string;
  /** The site, LinkedIn and the domain email: the only contact data a CV carries. */
  contact: Span[];
  sections: Section[];
  references: Reference[];
  /** One line closing Sources, only when some Claim is attested. */
  attestedNote?: string;
  /** Left side of every page's footer; the page number goes on the right. */
  footer: string;
}

// Other profiles stay on the About page.
const isLinkedIn = (url: string) => /(^|\.)linkedin\.com$/.test(new URL(url).hostname);

const linked = (url: string): Span => ({ text: hostPath(url), url });

function cvOf(record: ProfessionalRecord): Cv {
  const references = new Map<string, Reference>();
  /** The reference for `source`, numbered on first citation; one source cited twice keeps one number. */
  const cite = (source: Source): Reference => {
    const key = 'attested' in source ? `attested:${source.attested}` : absoluteUrl(hrefOf(source));
    let reference = references.get(key);
    if (!reference) {
      // Attested Claims rest on private evidence that only João can confirm, so they cite a note, not a link.
      reference =
        'attested' in source
          ? { number: references.size + 1, text: `Attested — ${source.attested}` }
          : { number: references.size + 1, ...linked(key) };
      references.set(key, reference);
    }
    return reference;
  };
  const claim = (title: string, sources: Source[], rest: Omit<Entry, 'title' | 'url' | 'references' | 'attested'>): Entry => {
    const cited = sources.map(cite);
    return {
      title,
      url: cited.find((reference) => reference.url)?.url,
      references: cited.map((reference) => reference.number),
      attested: sources.some((source) => 'attested' in source),
      ...rest,
    };
  };

  const sections: Section[] = [
    { label: 'Profile', paragraphs: [...paragraphsOf(record.interests), ...paragraphsOf(record.approach)], entries: [] },
    {
      label: 'Roles',
      paragraphs: [],
      entries: record.roles.map((r) =>
        claim(r.title, [r.source], { named: true, meta: { text: periodOf(r) }, detail: r.organisation, bullets: r.highlights }),
      ),
    },
    {
      label: 'Projects',
      paragraphs: [],
      entries: record.projects.map((p) =>
        claim(p.name, [p.source], { named: true, meta: p.url ? linked(p.url) : undefined, body: p.summary }),
      ),
    },
    {
      label: 'Skills',
      paragraphs: [],
      runOn: true,
      entries: record.skills.map((s) => claim(s.name, s.demonstrated, { named: false })),
    },
    { label: 'Achievements', paragraphs: [], entries: record.achievements.map((a) => claim(a.text, [a.source], { named: false })) },
    {
      label: 'Publications',
      paragraphs: [],
      entries: record.publications.map((p) =>
        claim(p.title, [p.source], { named: true, meta: p.url ? linked(p.url) : undefined }),
      ),
    },
    {
      label: 'Open-source contributions',
      paragraphs: [],
      entries: record.contributions.map((c) => claim(c.text, [c.source], { named: false })),
    },
    // A fact about João, not a Claim with a source, so it reads as one plain line.
    {
      label: 'Languages',
      paragraphs: record.languages.length ? [record.languages.join(' · ')] : [],
      entries: [],
    },
  ]
    .filter((section) => section.paragraphs.length || section.entries.length)
    .map((section) => ({ ...section, label: section.label.toUpperCase() }));

  const built = new Date().toLocaleDateString(uiOf(ORIGINAL_LANGUAGE).locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const cited = [...references.values()];
  return {
    name: record.name,
    headline: record.headline,
    contact: [
      ...(record.location ? [{ text: record.location }] : []),
      linked(record.url),
      ...record.sameAs.filter(isLinkedIn).map(linked),
      ...(record.email ? [{ text: record.email, url: `mailto:${record.email}` }] : []),
    ],
    sections,
    references: cited,
    attestedNote: cited.some((reference) => !reference.url)
      ? `Attested Claims rest on private evidence that only ${record.name} can confirm.`
      : undefined,
    footer: `${hostPath(absoluteUrl(ABOUT_PATH))} · generated ${built}`,
  };
}

/** Spans with `separator` between them, as one run of text. */
const joined = (spans: Span[], separator: string): Span[] =>
  spans.flatMap((span, i) => (i ? [{ text: separator }, span] : [span]));

// The site's light palette (src/styles/global.css): near-black ink, ink-blue accent for section labels only.
const INK = '#1d1b18';
const MUTED = '#5c574f';
const ACCENT = '#1f4396';
const RULE = '#ddd7ca';

// ---- PDF -------------------------------------------------------------------

// Source Serif 4 and Inter, the site's faces, as static OpenType files (SIL OFL, see cv-fonts/LICENSE.md
// and cv-fonts/Inter-LICENSE.txt). Paths are relative to the project root, where the build runs.
const font = (file: string) => readFileSync(`src/lib/cv-fonts/${file}.otf`);
const MM = 72 / 25.4;

/** One run of text in a flowing line. */
interface Run extends Span {
  font: 'serif' | 'serif-semibold' | 'serif-italic' | 'sans' | 'sans-semibold';
  size: number;
  color: string;
  features?: ('sups' | 'smcp' | 'tnum' | 'cpsp')[];
  characterSpacing?: number;
}

/** The CV as a PDF. */
export function cvPdf(record: ProfessionalRecord): Promise<Uint8Array> {
  const cv = cvOf(record);
  const margin = 18 * MM;
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: margin, left: margin, right: margin, bottom: margin + 6 * MM },
    font: font('SourceSerif4-Regular'),
    bufferPages: true,
    lang: 'en',
    displayTitle: true,
    info: { Title: `${cv.name}: CV`, Author: cv.name, Subject: cv.headline },
  });
  doc.registerFont('serif', font('SourceSerif4-Regular'));
  doc.registerFont('serif-semibold', font('SourceSerif4-Semibold'));
  doc.registerFont('serif-italic', font('SourceSerif4-It'));
  doc.registerFont('sans', font('Inter-Regular'));
  doc.registerFont('sans-semibold', font('Inter-SemiBold'));

  const chunks: Buffer[] = [];
  const { promise, resolve, reject } = Promise.withResolvers<Uint8Array>();
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const BODY = 10.5;
  // Source Serif 4's tall ascender and descender already set 10.5 pt lines 14.4 pt apart.
  const LEADING = 1;
  // Source Serif 4's ascender in ems (hhea): where a line's baseline sits below its top.
  const SERIF_ASCENT = 1.036;

  /** Runs as one flowing paragraph from (x, y), `w` wide. */
  const runs = (spans: Run[], x: number, y: number, w: number, lineGap = LEADING) => {
    spans.forEach((span, i) => {
      doc.font(span.font).fontSize(span.size).fillColor(span.color);
      const options = {
        continued: i < spans.length - 1,
        link: span.url ?? null,
        underline: false,
        lineGap,
        features: span.features ?? [],
        characterSpacing: span.characterSpacing ?? 0,
      };
      if (i === 0) doc.text(span.text, x, y, { ...options, width: w });
      else doc.text(span.text, options);
    });
    doc.x = left;
  };
  const body = (text: string): Run => ({ text, font: 'serif', size: BODY, color: INK });
  /** Moves to a new page unless `height` more points fit on this one. */
  const ensure = (height: number) => {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
  };

  /** A Claim's title, reference numbers and attested marker, as runs. */
  const titleRuns = (entry: Entry): Run[] => {
    const face = entry.named ? 'serif-semibold' : 'serif';
    return [
      { text: entry.title, url: entry.url, font: face, size: BODY, color: INK },
      { text: entry.references.join(','), url: entry.url, font: face, size: BODY, color: ACCENT, features: ['sups'] },
      ...(entry.attested
        ? [{ text: ' attested', font: 'serif', size: BODY, color: MUTED, features: ['smcp'], characterSpacing: 0.3 } as Run]
        : []),
    ];
  };

  // Header: name, headline, one contact line.
  runs([{ text: cv.name, font: 'sans-semibold', size: 22, color: INK, characterSpacing: -0.2 }], left, doc.y, width, 0);
  doc.moveDown(0.15);
  runs([{ text: cv.headline, font: 'serif', size: 12.5, color: INK }], left, doc.y, width, 0);
  doc.moveDown(0.5);
  runs(
    joined(cv.contact, ' · ').map((span) => ({ ...span, font: 'sans', size: 8.5, color: MUTED })),
    left,
    doc.y,
    width,
    0,
  );

  /** A section label: small capitals in the accent with a hairline under it. */
  const label = (text: string) => {
    // Room for the label and a few lines under it, so a label never ends a page alone.
    ensure(90);
    doc.y += 14;
    // Inter's capital spacing plus a little tracking; more and PDF readers read the label as spaced letters.
    runs([{ text, font: 'sans-semibold', size: 7.5, color: ACCENT, features: ['cpsp'], characterSpacing: 0.5 }], left, doc.y, width, 0);
    const y = doc.y + 3;
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.y = y + 9;
  };

  for (const section of cv.sections) {
    label(section.label);
    for (const paragraph of section.paragraphs) {
      runs([body(paragraph)], left, doc.y, width);
      doc.y += 5;
    }
    if (section.runOn) {
      runs(
        section.entries.flatMap((entry, i) => [...(i ? [body(' · ')] : []), ...titleRuns(entry)]),
        left,
        doc.y,
        width,
      );
      doc.y += 7;
      continue;
    }
    for (const entry of section.entries) {
      doc.font('serif').fontSize(BODY);
      const line = doc.currentLineHeight() + LEADING;
      ensure(line * (entry.detail ? 2 : 1) + (entry.body ? doc.heightOfString(entry.body, { width, lineGap: LEADING }) : 0));
      const top = doc.y;
      let metaWidth = 0;
      // Tabular figures line the periods up; addresses keep proportional punctuation.
      const figures: Run['features'] = entry.meta?.url ? [] : ['tnum'];
      if (entry.meta) {
        doc.font('sans').fontSize(8.5);
        metaWidth = doc.widthOfString(entry.meta.text, { features: figures }) + 16;
      }
      runs(titleRuns(entry), left, top, width - metaWidth);
      const end = doc.y;
      if (entry.meta) {
        // On the title's baseline, so the dates line up down the right edge.
        doc.font('sans').fontSize(8.5).fillColor(MUTED);
        doc.text(entry.meta.text, left, top + SERIF_ASCENT * BODY, {
          width,
          align: 'right',
          baseline: 'alphabetic',
          link: entry.meta.url ?? null,
          underline: false,
          features: figures,
          lineBreak: false,
        });
      }
      doc.x = left;
      doc.y = end;
      if (entry.detail) runs([{ text: entry.detail, font: 'serif-italic', size: BODY, color: MUTED }], left, doc.y, width);
      if (entry.body) {
        doc.y += 1;
        runs([body(entry.body)], left, doc.y, width);
      }
      // Highlights hang from a bullet, so a wrapped line starts under the text, not under the bullet.
      const INDENT = 12;
      for (const bullet of entry.bullets ?? []) {
        doc.y += 2;
        doc.font('serif').fontSize(BODY);
        ensure(doc.heightOfString(bullet, { width: width - INDENT, lineGap: LEADING }));
        const top = doc.y;
        doc.fillColor(MUTED).text('•', left + 2, top, { lineBreak: false });
        runs([body(bullet)], left + INDENT, top, width - INDENT);
      }
      doc.y += 7;
    }
  }

  // Sources: every reference, numbered, as host and path, so a printed CV stays traceable.
  label('SOURCES');
  const NUMBER = 14;
  for (const reference of cv.references) {
    ensure(12);
    const top = doc.y;
    doc.font('sans').fontSize(8).fillColor(MUTED);
    doc.text(String(reference.number), left, top, { width: NUMBER, align: 'right', features: ['tnum'], lineGap: 2.5 });
    runs([{ text: reference.text, url: reference.url, font: 'sans', size: 8, color: MUTED }], left + NUMBER + 8, top, width - NUMBER - 8, 2.5);
  }
  if (cv.attestedNote) {
    doc.y += 6;
    runs([{ text: cv.attestedNote, font: 'serif-italic', size: 9, color: MUTED }], left, doc.y, width, 0);
  }

  // Footer on every page; the bottom margin is lifted so writing below it does not add a page.
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    const margins = doc.page.margins;
    doc.page.margins = { ...margins, bottom: 0 };
    const y = doc.page.height - margin;
    doc.font('sans').fontSize(7.5).fillColor(MUTED);
    doc.text(cv.footer, left, y, { width, lineBreak: false, link: absoluteUrl(ABOUT_PATH), underline: false });
    doc.text(`${i + 1} / ${pages.count}`, left, y, { width, align: 'right', lineBreak: false, features: ['tnum'] });
    doc.page.margins = margins;
  }
  doc.end();
  return promise;
}

// ---- DOCX ------------------------------------------------------------------

// Word documents name a font rather than embed one, and recruiters have neither Source Serif 4 nor
// Inter: Georgia and Arial are on every Windows and Mac install.
const SERIF = 'Georgia';
const SANS = 'Arial';
const hex = (colour: string) => colour.slice(1);
// Twentieths of a point: A4 with 18 mm margins.
const TWIPS_PER_MM = 1440 / 25.4;
const PAGE = { width: 11906, height: 16838, margin: Math.round(18 * TWIPS_PER_MM) };
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;

/** Runs that link in the text's own colour, never Word's blue underline. */
const docxRuns = (spans: Span[], options: IRunOptions): ParagraphChild[] =>
  spans.map((span) => {
    const run = new TextRun({ ...options, text: span.text });
    return span.url ? new ExternalHyperlink({ link: span.url, children: [run] }) : run;
  });

/** A Claim's title, reference numbers and attested marker. */
const docxTitle = (entry: Entry): ParagraphChild[] => [
  ...docxRuns([{ text: entry.title, url: entry.url }], { bold: entry.named, color: hex(INK) }),
  ...docxRuns([{ text: entry.references.join(','), url: entry.url }], { superScript: true, color: hex(ACCENT) }),
  ...(entry.attested ? [new TextRun({ text: ' attested', smallCaps: true, color: hex(MUTED) })] : []),
];

/** The CV as a DOCX. */
export async function cvDocx(record: ProfessionalRecord): Promise<Uint8Array> {
  const cv = cvOf(record);
  const label = (text: string) =>
    new Paragraph({
      keepNext: true,
      spacing: { before: 400, after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 3, color: hex(RULE) } },
      children: [new TextRun({ text, font: SANS, size: 15, bold: true, color: hex(ACCENT), characterSpacing: 18 })],
    });
  const meta = { font: SANS, size: 17, color: hex(MUTED) };
  const rightTab = [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }];

  const entry = (claim: Entry) => {
    const last = !claim.detail && !claim.body && !claim.bullets?.length;
    const bullets = claim.bullets ?? [];
    return [
      new Paragraph({
        keepNext: !last,
        tabStops: rightTab,
        spacing: { after: last ? 160 : 0 },
        children: [
          ...docxTitle(claim),
          ...(claim.meta ? [new TextRun({ text: '\t', ...meta }), ...docxRuns([claim.meta], meta)] : []),
        ],
      }),
      ...(claim.detail
        ? [
            new Paragraph({
              keepNext: !!claim.body || bullets.length > 0,
              spacing: { after: claim.body || bullets.length ? 0 : 160 },
              children: [new TextRun({ text: claim.detail, italics: true, color: hex(MUTED) })],
            }),
          ]
        : []),
      ...(claim.body
        ? [new Paragraph({ spacing: { before: 20, after: bullets.length ? 0 : 160 }, children: [new TextRun(claim.body)] })]
        : []),
      ...bullets.map(
        (bullet, i) =>
          new Paragraph({
            tabStops: [{ type: TabStopType.LEFT, position: 240 }],
            indent: { left: 240, hanging: 240 },
            spacing: { before: 40, after: i === bullets.length - 1 ? 160 : 0 },
            children: [new TextRun({ text: '•\t', color: hex(MUTED) }), new TextRun(bullet)],
          }),
      ),
    ];
  };

  const children = [
    new Paragraph({ children: [new TextRun({ text: cv.name, font: SANS, size: 44, bold: true })] }),
    new Paragraph({ spacing: { before: 40, after: 100 }, children: [new TextRun({ text: cv.headline, size: 25 })] }),
    new Paragraph({ children: docxRuns(joined(cv.contact, ' · '), meta) }),
    ...cv.sections.flatMap((section) => [
      label(section.label),
      ...section.paragraphs.map((paragraph) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun(paragraph)] })),
      ...(section.runOn
        ? [new Paragraph({ children: section.entries.flatMap((claim, i) => [...(i ? [new TextRun(' · ')] : []), ...docxTitle(claim)]) })]
        : section.entries.flatMap(entry)),
    ]),
    label('SOURCES'),
    ...cv.references.map(
      (reference) =>
        new Paragraph({
          tabStops: [{ type: TabStopType.LEFT, position: 360 }],
          indent: { left: 360, hanging: 360 },
          spacing: { after: 20 },
          children: [new TextRun({ text: `${reference.number}\t`, ...meta, size: 16 }), ...docxRuns([reference], { ...meta, size: 16 })],
        }),
    ),
    ...(cv.attestedNote
      ? [new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: cv.attestedNote, size: 18, italics: true, color: hex(MUTED) })] })]
      : []),
  ];
  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: rightTab,
        children: [
          ...docxRuns([{ text: cv.footer, url: absoluteUrl(ABOUT_PATH) }], { ...meta, size: 15 }),
          new TextRun({ ...meta, size: 15, children: ['\t', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES] }),
        ],
      }),
    ],
  });
  const doc = new Document({
    creator: cv.name,
    title: `${cv.name}: CV`,
    description: cv.headline,
    styles: {
      default: {
        document: {
          run: { font: SERIF, size: 21, color: hex(INK) },
          paragraph: { spacing: { line: 288 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin + 340, left: PAGE.margin, footer: PAGE.margin - 280 },
          },
        },
        footers: { default: footer },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
