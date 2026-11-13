import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { render } from 'astro:content';
import type { Project } from './projects';

/** Turn bold- or code-led Markdown bullets into term/description rows without changing their source. */
function definitionRows(html: string): string {
  return html.replace(/<ul>([\s\S]*?)<\/ul>/g, (list, body: string) => {
    const items = [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)];
    if (items.length === 0) return list;
    const rows = items.map((match) => {
      const item = match[1].trim();
      const lead = item.match(/^(<strong>[\s\S]*?<\/strong>|<code>[\s\S]*?<\/code>)\s*([\s\S]*)$/);
      return lead && `<div><dt>${lead[1]}</dt><dd>${lead[2].trim()}</dd></div>`;
    });
    return rows.every(Boolean) ? `<dl class="definition-rows">${rows.join('')}</dl>` : list;
  });
}

/** Render a Project body, grouping each h2 and its content into the shared labelled-row primitive. */
export async function renderProjectBody(project: Project): Promise<string> {
  const { Content } = await render(project);
  const container = await AstroContainer.create();
  const html = await container.renderToString(Content);
  const chunks = html.split(/(?=<h2\b[^>]*>)/);
  const preamble = chunks[0].trim();
  const lead = preamble ? `<div class="project-intro">${definitionRows(preamble)}</div>` : '';
  return lead + chunks.slice(1).map((chunk) => {
    const heading = chunk.match(/^<h2([^>]*)>([\s\S]*?)<\/h2>/);
    if (!heading) return definitionRows(chunk);
    const content = chunk.slice(heading[0].length).trim();
    return `<section class="labelled-row"><h2${heading[1]} class="row-label">${heading[2]}</h2><div class="row-content">${definitionRows(content)}</div></section>`;
  }).join('');
}
