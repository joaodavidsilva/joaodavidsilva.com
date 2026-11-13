import * as writing from './articles';
import * as knowledge from './knowledge';
import * as projects from './projects';
import { dateOf, getNow, NOW_PATH } from './now';
import { readingMinutesOf } from './own-folder';
import { CV_PATH, getRecord, statsOf, type ProfessionalRecord } from './record';
import { absolute, originalIdOf, pathIn, twinOf, type Language } from './translations';
import { uiOf, type Ui } from './ui';

export interface HomeContactLink {
  label: string;
  href: string;
}

const edpRoleOf = (record?: ProfessionalRecord) =>
  record?.roles.find((role) => role.organisation === 'EDP' && !role.end);
const highlightText = (highlight: ProfessionalRecord['roles'][number]['highlights'][number]) =>
  typeof highlight === 'string' ? highlight : highlight.text;

/** The three record-backed facts beside the Home hero. */
export function heroFactsOf(record: ProfessionalRecord | undefined, ui = uiOf(record?.language ?? 'en')) {
  const edp = edpRoleOf(record);
  const led = record?.roles.find((role) => role.organisation === 'Reflaunt');
  const period = led && `${led.start.slice(0, 4)}–${led.end?.slice(2, 4) ?? ui.record.present}`;
  return {
    eyebrow: record ? [record.headline.split(':')[0], record.location].filter(Boolean).join(' · ') : undefined,
    now: edp ? ui.redesign.home.nowFact(edp.title, edp.organisation) : undefined,
    led: led && period ? ui.redesign.home.ledFact(led.title, led.organisation, period) : undefined,
    stack: edp?.stack.filter((item) => ['React Native', 'TypeScript', 'Python'].includes(item)).join(', '),
  };
}

const LANGUAGE_ALIASES = [
  ['portuguese', ['Portuguese', 'Português']],
  ['english', ['English', 'Inglês']],
  ['spanish', ['Spanish', 'Espanhol']],
] as const;

/** The Home EDP stats, derived from the attested role highlights rather than hard-coded numbers. */
export function practiceStatsOf(record: ProfessionalRecord | undefined, ui: Ui) {
  const highlights = edpRoleOf(record)?.highlights.map(highlightText) ?? [];
  const users = record ? statsOf(record).attestedUsers : undefined;
  const text = highlights.join(' ').toLocaleLowerCase();
  const languages = LANGUAGE_ALIASES
    .filter(([, aliases]) => aliases.some((alias) => text.includes(alias.toLocaleLowerCase())))
    .map(([language]) => ui.redesign.home.languageNames[language]);
  const attested = ui.record.attested.toLocaleLowerCase(ui.locale);
  const number = new Intl.NumberFormat(ui.locale);
  return [
    ...(users !== undefined ? [{ value: `${number.format(users)}+`, label: `${ui.redesign.home.attestedUsers} · ${attested}` }] : []),
    ...(languages.length ? [{ value: String(languages.length), label: `${ui.record.languages.toLocaleLowerCase(ui.locale)}: ${languages.join(', ')}` }] : []),
  ];
}

export function contactLinksOf(record: ProfessionalRecord | undefined): HomeContactLink[] {
  if (!record) return [];
  const external = [
    { label: 'LinkedIn ↗', host: 'linkedin.com' },
    { label: 'GitHub ↗', host: 'github.com' },
  ].flatMap(({ label, host }) => {
    const href = record.sameAs.find((url) => new URL(url).hostname.endsWith(host));
    return href ? [{ label, href }] : [];
  });
  return [
    ...(record.email ? [{ label: record.email, href: `mailto:${record.email}` }] : []),
    ...external,
    { label: 'CV · PDF', href: CV_PATH },
  ];
}

/** Everything dynamic on Home, in the same language as the requested Home page. */
export async function homeOf(language: Language) {
  const [articles, entries, projectListings, now, record] = await Promise.all([
    writing.getArticles(language),
    knowledge.getKnowledge(language),
    projects.getProjectListings(language),
    getNow(language),
    getRecord(language),
  ]);
  const article = articles[0];
  return {
    record,
    now: now && { date: dateOf(now), path: pathIn(NOW_PATH, language), twin: twinOf(pathIn(NOW_PATH, language)) },
    hero: heroFactsOf(record),
    stats: practiceStatsOf(record, uiOf(language)),
    latest: article && {
      title: article.data.title,
      summary: article.data.summary,
      published: writing.metadataOf(article).published,
      minutes: readingMinutesOf(article),
      path: writing.pathOf(article),
      twin: writing.twinPathOf(article),
    },
    projects: projectListings.filter((project) => projects.PROJECT_ORDER.includes(originalIdOf(project))).map((project) => ({
      name: project.data.name,
      oneLine: project.data.oneLine,
      status: project.data.status,
      version: project.data.version,
      external: project.data.external === true,
      path: project.data.external ? undefined : projects.pathOf(project),
      twin: project.data.external ? undefined : projects.twinPathOf(project),
    })),
    knowledge: knowledge.byCategory(entries).map((group) => ({
      category: group.category,
      titles: group.entries.map(({ entry }) => entry.data.title),
    })),
    contact: contactLinksOf(record),
  };
}

/** Dynamic Home sections as Markdown, complementing the authored body in the page twin. */
export async function homeMarkdown(language: Language): Promise<string> {
  const ui = uiOf(language);
  const home = await homeOf(language);
  return [
    '## At a glance',
    '',
    ...(home.hero.now && home.now ? [`- ${ui.redesign.home.now}: [${home.hero.now}](${absolute(home.now.twin)})`] : []),
    ...(home.hero.led ? [`- ${ui.redesign.home.led}: ${home.hero.led}`] : []),
    ...(home.hero.stack ? [`- ${ui.redesign.home.stack}: ${home.hero.stack}`] : []),
    '',
    ...(home.stats.length ? ['### In practice: current facts', '', ...home.stats.map((stat) => `- ${stat.value}: ${stat.label}`), ''] : []),
    ...(home.latest ? [
      '## Writing', '',
      `${ui.article} · ${home.latest.published} · ${ui.minRead(home.latest.minutes)}`, '',
      `[${home.latest.title}](${absolute(home.latest.twin)}): ${home.latest.summary}`, '',
      `[${ui.sections.research}](${absolute(twinOf(pathIn('/research/', language)))})`, '',
    ] : []),
    ...(home.projects.length ? [
      '## Projects', '',
      `[${ui.redesign.home.allProjects}](${absolute(twinOf(pathIn('/projects/', language)))})`, '',
      ...home.projects.map((project) => `- ${project.twin ? `[${project.name}](${absolute(project.twin)})` : project.name} (${projects.projectStatusLabelOf(project, ui)}): ${project.oneLine}`), '',
    ] : []),
    ...(home.knowledge.length ? [
      '## Knowledge', '',
      `[${ui.redesign.home.searchKnowledge}](${absolute(twinOf(pathIn('/knowledge/', language)))})`, '',
      ...home.knowledge.map((group) => `- ${group.category} (${ui.redesign.entryCount(group.titles.length)}): ${group.titles.join(' · ')}`), '',
    ] : []),
    ...(home.contact.length ? ['## Contact', '', ...home.contact.map((link) => `- [${link.label}](${link.href})`), ''] : []),
  ].join('\n').trimEnd();
}
