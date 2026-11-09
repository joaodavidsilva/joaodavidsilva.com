// Markdown twins (ADR-0003): front-matter plus Markdown sections, served as text/markdown.

/** Free-text fields are quoted; the rest (dates, URLs, enums, flags) are plain YAML scalars. */
const TEXT_FIELDS: Record<string, true> = { title: true, summary: true, category: true, version: true };

type Value = string | number | boolean | string[] | undefined | { [field: string]: Value };

function linesOf(fields: { [field: string]: Value }, indent = ''): string[] {
  return Object.entries(fields).flatMap(([field, value]): string[] => {
    if (value === undefined) return [];
    if (Array.isArray(value)) return [`${indent}${field}: [${value.map((item) => JSON.stringify(item)).join(', ')}]`];
    if (typeof value === 'object') return [`${indent}${field}:`, ...linesOf(value, `${indent}  `)];
    return [`${indent}${field}: ${TEXT_FIELDS[field] ? JSON.stringify(value) : value}`];
  });
}

/** A twin: `fields` as front-matter (undefined fields left out), then the non-empty `sections`. */
export function markdownResponse(fields: { [field: string]: Value }, sections: (string | false | undefined)[]): Response {
  const frontMatter = ['---', ...linesOf(fields), '---'].join('\n');
  const body = sections.filter((section): section is string => Boolean(section)).join('\n\n');
  return new Response(`${frontMatter}\n\n${body}\n`, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
