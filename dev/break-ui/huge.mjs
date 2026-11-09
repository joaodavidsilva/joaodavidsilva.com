// Writes the "1,000 rows" content set: every list at its realistic upper bound, unpaginated.
// Deterministic (no randomness), so two runs produce the same set. Usage: node dev/break-ui/huge.mjs <outDir>
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_CATEGORIES } from '../../site.config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) throw new Error('Usage: node dev/break-ui/huge.mjs <outDir>');

export const COUNTS = { knowledge: 1200, tags: 400, articles: 1000, seriesParts: 150, studies: 300, projects: 60 };

const WORDS = (
  'agent context window token budget harness tool call session compaction clearing model provider review ' +
  'specification regression test fixture pipeline deploy worker cache index search latency throughput ' +
  'orchestration subagent prompt retrieval embedding evaluation benchmark rubric guardrail sandbox trace ' +
  'span metric schema migration contract boundary adapter port domain glossary decision record'
).split(' ');
const word = (i) => WORDS[i % WORDS.length];
const words = (seed, n) => Array.from({ length: n }, (_, i) => word(seed * 7 + i * 13));
const sentence = (seed, n) => {
  const w = words(seed, n).join(' ');
  return `${w[0].toUpperCase()}${w.slice(1)}.`;
};
const title = (seed, n) => sentence(seed, n).slice(0, -1);
/** A sentence of up to `n` words, cut to at most `max` characters (the schema's limit for the field). */
const upTo = (max, seed, n) => {
  let text = sentence(seed, n);
  while (text.length > max) text = sentence(seed, --n);
  return text;
};
const paragraph = (seed) => Array.from({ length: 6 }, (_, i) => sentence(seed + i, 12 + (i % 5))).join(' ');
const body = (seed, paragraphs = 3) => Array.from({ length: paragraphs }, (_, i) => paragraph(seed * 31 + i)).join('\n\n');
const day = (offset) => new Date(Date.UTC(2026, 10, 9) - offset * 86_400_000).toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(4, '0');
const yaml = (s) => JSON.stringify(s);
const file = (path, text) => {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), text);
};

rmSync(out, { recursive: true, force: true });
// Pages, Now and the record come from the One set: the Huge set stresses list lengths, not them.
for (const part of ['pages', 'now.md', 'record.yaml']) cpSync(join(here, 'sets', 'one', part), join(out, part), { recursive: true });

const tags = Array.from({ length: COUNTS.tags }, (_, i) => `${word(i)}-${word(i * 3 + 1)}-${i}`);

for (let i = 0; i < COUNTS.knowledge; i++) {
  const id = `entry-${pad(i)}`;
  const entryTags = Array.from({ length: 3 + (i % 4) }, (_, j) => tags[(i * 5 + j * 17) % tags.length]);
  const related = [1, 2, 3].map((d) => `entry-${pad((i + d * 37) % COUNTS.knowledge)}`);
  file(
    `knowledge/${id}.md`,
    `---\nkind: ${i % 5 === 0 ? 'guide' : 'concept'}\ntitle: ${yaml(title(i, 2 + (i % 6)))}\nsummary: ${yaml(upTo(200, i + 1, 14 + (i % 10)))}\n` +
      `published: ${day(i)}\ncategory: ${yaml(KNOWLEDGE_CATEGORIES[i % KNOWLEDGE_CATEGORIES.length])}\ntags: ${JSON.stringify(entryTags)}\nrelated: [${related.join(', ')}]\n---\n\n${body(i)}\n`,
  );
}

file(
  'series/journal.md',
  `---\ntitle: "A ${COUNTS.seriesParts}-part journal"\nsummary: A Series long enough to test its parts list.\npublished: ${day(COUNTS.articles)}\nstatus: ongoing\n---\n\n${paragraph(1)}\n`,
);
for (let i = 0; i < COUNTS.articles; i++) {
  const part = i < COUNTS.seriesParts ? `series: journal\npart: ${COUNTS.seriesParts - i}\n` : '';
  file(
    `articles/article-${pad(i)}.md`,
    `---\ntitle: ${yaml(title(i, 4 + (i % 9)))}\nsummary: ${yaml(upTo(200, i + 2, 16 + (i % 12)))}\npublished: ${day(i)}\n` +
      `tags: ${JSON.stringify([tags[i % tags.length], tags[(i + 9) % tags.length]])}\nfeatured: ${i % 20 === 0}\n${part}---\n\n${body(i, 8)}\n`,
  );
}

const SECTIONS = ['Question', 'Hypothesis', 'Method', 'Observations', 'Findings', 'Limitations'];
const STATUSES = ['in progress', 'concluded', 'abandoned'];
for (let i = 0; i < COUNTS.studies; i++) {
  file(
    `studies/study-${pad(i)}.md`,
    `---\ntitle: ${yaml(title(i + 5, 5 + (i % 8)))}\nsummary: ${yaml(upTo(200, i + 3, 18))}\npublished: ${day(i * 2)}\n` +
      `status: ${STATUSES[i % 3]}\nfeatured: ${i % 15 === 0}\n---\n\n${SECTIONS.map((s, j) => `## ${s}\n\n${paragraph(i + j)}`).join('\n\n')}\n`,
  );
}

const PROJECT_STATUSES = ['active', 'in development', 'paused', 'archived'];
for (let i = 0; i < COUNTS.projects; i++) {
  file(
    `projects/project-${pad(i)}.md`,
    `---\nname: ${yaml(title(i + 11, 1 + (i % 3)))}\noneLine: ${yaml(upTo(120, i + 4, 12 + (i % 14)))}\nstatus: ${PROJECT_STATUSES[i % 4]}\n` +
      `${i % 3 ? `version: "${1 + (i % 4)}.${i % 10}.${i}"\n` : ''}published: ${day(i * 9)}\n---\n\n${body(i, 2)}\n`,
  );
}

console.log(`Huge set written to ${out}: ${JSON.stringify(COUNTS)}`);
