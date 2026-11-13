import { inlineMarkdown, inlineParagraph } from './inline-markdown';
import { ORIGINAL_LANGUAGE, type Language } from './translations';
import { uiOf } from './ui';

export interface HomeStep {
  title: string;
  description: string;
}

/** Authored Home copy, parsed from the same Markdown served as the page's twin. */
export interface HomeContent {
  title: string;
  intro: string;
  method: { title: string; steps: HomeStep[]; footer: string };
  practice: { title: string; copy: string; stack: string; recordLink: string };
  projectsTitle: string;
  knowledgeTitle: string;
}

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`content/pages/index.md: missing ${name}`);
  return value;
};

/** Parse the deliberate headings/list convention in `content/pages/index.md`. */
export function homeContentOf(body = '', language: Language = ORIGINAL_LANGUAGE): HomeContent {
  const words = uiOf(language).redesign.home;
  const lines = body.split('\n');
  const title = required(lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, ''), '# title');
  const introLines: string[] = [];
  const sections = new Map<string, string[]>();
  let section: string[] | undefined;
  let beforeSections = true;
  for (const line of lines) {
    const h1 = line.match(/^#\s+/);
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h1) continue;
    if (h2) {
      section = [];
      sections.set(h2[1], section);
      beforeSections = false;
    } else if (beforeSections && line.trim()) introLines.push(line.trim());
    else section?.push(line);
  }

  const methodLines = sections.get(words.howIWork) ?? [];
  const methodTitle = required(methodLines.find((line) => line.trim() && !/^\d+\.\s/.test(line)), `${words.howIWork} title`);
  const steps = methodLines.flatMap((line) => {
    const match = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*(.*)$/);
    return match ? [{ title: inlineMarkdown(match[1]), description: inlineMarkdown(match[2]) }] : [];
  });
  const footer = required(methodLines.filter((line) => line.trim()).at(-1), `${words.howIWork} footer`);

  const practiceLines = sections.get(words.inPractice) ?? [];
  const practiceTitle = required(practiceLines.find((line) => /^###\s+/.test(line))?.replace(/^###\s+/, ''), `${words.inPractice} title`);
  const practiceParagraphs = practiceLines
    .filter((line) => !/^###\s+/.test(line))
    .join('\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const sectionTitle = (name: string) =>
    inlineMarkdown(required((sections.get(name) ?? []).find((line) => /^###\s+/.test(line))?.replace(/^###\s+/, ''), `${name} title`));

  return {
    title: inlineMarkdown(title),
    intro: inlineParagraph(introLines),
    method: {
      title: inlineMarkdown(methodTitle),
      steps,
      footer: inlineMarkdown(footer),
    },
    practice: {
      title: inlineMarkdown(practiceTitle),
      copy: inlineMarkdown(required(practiceParagraphs[0], `${words.inPractice} copy`)),
      stack: inlineMarkdown(required(practiceParagraphs[1], `${words.inPractice} stack`)),
      recordLink: inlineMarkdown(required(practiceParagraphs[2], `${words.inPractice} record link`)),
    },
    projectsTitle: sectionTitle(words.projects),
    knowledgeTitle: sectionTitle(words.knowledge),
  };
}
