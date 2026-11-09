/**
 * Long-form Markdown components, as hast plugins on Astro's Markdown processor:
 *
 * - Figures: an image alone in its paragraph with a title, `![Alt](./d.svg "Caption")`,
 *   becomes a `<figure>` with that title as its `<figcaption>`.
 * - Callouts: a blockquote opening with a GitHub alert marker, `> [!NOTE]`, becomes a
 *   labelled callout. The Markdown twin keeps the marker, which GitHub also renders.
 * - Tables: each `<table>` sits in a focusable, labelled scroll region,
 *   `<div class="table-scroll" tabindex="0" role="region" aria-label="Table">`, so a wide
 *   table scrolls inside the column (keyboard included) instead of widening the page.
 *   The label is in the document's `language` (front-matter), English by default.
 *
 * Footnotes (GFM) and code highlighting (Shiki `css-variables`) come from the processor;
 * cross-references are plain links, checked by the link check.
 */

const CALLOUT_KINDS = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
};
const CALLOUT_MARKER = /^\[!(\w+)\][^\S\n]*(?:\n|$)/;
const TABLE_LABELS = { en: 'Table', pt: 'Tabela', es: 'Tabla', fr: 'Tableau', de: 'Tabelle', it: 'Tabella' };

const isBlank = (node) => node.type === 'text' && !node.value.trim();
const element = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });

const figures = {
  name: 'long-form-figures',
  element: {
    filter: ['p'],
    visit(paragraph, ctx) {
      const content = paragraph.children.filter((child) => !isBlank(child));
      const [image] = content;
      if (content.length !== 1 || image.type !== 'element' || image.tagName !== 'img') return;
      const { title, ...properties } = image.properties;
      if (typeof title !== 'string' || !title.trim()) return;
      ctx.replaceNode(
        paragraph,
        element('figure', {}, [
          element('img', properties, []),
          element('figcaption', {}, [text(title)]),
        ]),
      );
    },
  },
};

const callouts = {
  name: 'long-form-callouts',
  element: {
    filter: ['blockquote'],
    visit(quote, ctx) {
      const blocks = quote.children.filter((child) => !isBlank(child));
      const [first] = blocks;
      if (first?.type !== 'element' || first.tagName !== 'p') return;
      const [lead, ...rest] = first.children;
      const marker = lead?.type === 'text' ? lead.value.match(CALLOUT_MARKER) : null;
      const label = marker && CALLOUT_KINDS[marker[1].toUpperCase()];
      if (!label) return;
      const remainder = lead.value.slice(marker[0].length);
      const opening = [...(remainder ? [text(remainder)] : []), ...rest];
      ctx.replaceNode(
        quote,
        element('div', { className: ['callout'], role: 'note', dataKind: marker[1].toLowerCase() }, [
          element('p', { className: ['callout-label'] }, [text(label)]),
          ...(opening.some((child) => !isBlank(child)) ? [element('p', {}, opening)] : []),
          ...blocks.slice(1),
        ]),
      );
    },
  },
};

// The document's front-matter `language`, which Astro seeds into the processor's data bag.
const tables = ({ data }) => {
  const label = TABLE_LABELS[data?.astro?.frontmatter?.language] ?? TABLE_LABELS.en;
  return {
    name: 'long-form-tables',
    element: {
      filter: ['table'],
      visit(table, ctx) {
        ctx.wrapNode(table, element('div', { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: label }, []));
      },
    },
  };
};

/** Registers the long-form components on the Markdown processor. */
export function longFormMarkdown() {
  return {
    name: 'long-form-markdown',
    hooks: {
      'astro:config:setup'({ config }) {
        config.markdown.processor.options.hastPlugins.push(figures, callouts, tables);
      },
    },
  };
}
