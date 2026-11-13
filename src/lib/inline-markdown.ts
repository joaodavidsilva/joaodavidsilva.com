import { escapeMarkup } from './escape';

/**
 * Render the small inline-Markdown vocabulary used by Home and Now content.
 * Raw HTML is deliberately escaped: these files stay readable, portable Markdown twins.
 */
export function inlineMarkdown(text: string): string {
  const token = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^)\s]+\))/g;
  let html = '';
  let cursor = 0;
  for (const match of text.matchAll(token)) {
    const index = match.index;
    html += escapeMarkup(text.slice(cursor, index));
    const value = match[0];
    if (value.startsWith('`')) html += `<code>${escapeMarkup(value.slice(1, -1))}</code>`;
    else if (value.startsWith('**')) html += `<strong>${inlineMarkdown(value.slice(2, -2))}</strong>`;
    else if (value.startsWith('*')) html += `<em>${inlineMarkdown(value.slice(1, -1))}</em>`;
    else {
      const link = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      html += `<a href="${escapeMarkup(link[2])}">${inlineMarkdown(link[1])}</a>`;
    }
    cursor = index + value.length;
  }
  return html + escapeMarkup(text.slice(cursor));
}

/** A paragraph or list item's inline content, without a block-level wrapper. */
export const inlineParagraph = (lines: string[]) => inlineMarkdown(lines.join(' ').trim());
