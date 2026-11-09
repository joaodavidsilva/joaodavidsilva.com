import { getCollection } from 'astro:content';
import { SITE_URL } from '../../site.config.mjs';
import { getPages, pathOf } from './pages';
import type { Record, Source } from './record-schema';

export type { Record, Source };

export const ABOUT_PATH = '/about/';
export const ABOUT_TITLE = 'About';

/** The Professional record, or undefined when the content set has none. Internal sources must resolve. */
export async function getRecord(): Promise<Record | undefined> {
  const [entry] = await getCollection('record');
  if (!entry) return undefined;
  const record = entry.data as Record;
  const paths = new Set([...(await getPages()).map(pathOf), ABOUT_PATH]);
  const refs: { page?: string }[] = [
    ...record.roles, ...record.projects, ...record.achievements, ...record.publications, ...record.contributions,
  ].map((claim) => claim.source);
  refs.push(...record.skills.flatMap((skill) => skill.demonstrated));
  for (const ref of refs) {
    if (ref.page && !paths.has(ref.page)) {
      throw new Error(`record.yaml: source page "${ref.page}" does not exist on the site`);
    }
  }
  return record;
}

export const currentRoles = (record: Record) => record.roles.filter((role) => !role.end);

/** Person JSON-LD, generated from the record alone. */
export function personOf(record: Record) {
  const [current] = currentRoles(record);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: record.name,
    description: record.headline,
    url: record.url,
    ...(record.email && { email: `mailto:${record.email}` }),
    ...(record.sameAs.length && { sameAs: record.sameAs }),
    ...(current && {
      jobTitle: current.title,
      worksFor: { '@type': 'Organization', name: current.organisation },
    }),
    ...(record.skills.length && { knowsAbout: record.skills.map((skill) => skill.name) }),
    ...(record.achievements.length && { award: record.achievements.map((a) => a.text) }),
  };
}

/** Paragraphs of one of João's prose fields; empty when he has not written it. */
export const paragraphsOf = (prose: string | undefined) =>
  (prose ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export function hrefOf(source: { page: string } | { url: string }): string {
  return 'page' in source ? source.page : source.url;
}

const absolute = (href: string) => new URL(href, SITE_URL).href;

function sourceMd(source: Source): string {
  return 'attested' in source ? `(Attested: ${source.attested})` : `([source](${absolute(hrefOf(source))}))`;
}

const period = (role: Record['roles'][number]) => `${role.start} – ${role.end ?? 'present'}`;

/** The About page as Markdown, from the same record as the HTML. */
export function aboutMarkdown(record: Record): string {
  const out = [`# ${ABOUT_TITLE}`, '', `${record.name}. ${record.headline}`, ''];
  const section = (title: string, lines: string[]) => {
    if (lines.length) out.push(`## ${title}`, '', ...lines, '');
  };
  section('Interests', paragraphsOf(record.interests).flatMap((p, i) => (i ? ['', p] : [p])));
  section('Approach to engineering', paragraphsOf(record.approach).flatMap((p, i) => (i ? ['', p] : [p])));
  section('Roles', record.roles.map((r) => `- ${r.title}, ${r.organisation}, ${period(r)}. ${sourceMd(r.source)}`));
  section('Projects', record.projects.map((p) => `- ${p.name}: ${p.summary} ${sourceMd(p.source)}`));
  section(
    'Skills',
    record.skills.map(
      (s) => `- ${s.name}, demonstrated in: ${s.demonstrated.map((d) => `<${absolute(hrefOf(d))}>`).join(', ')}`,
    ),
  );
  section('Achievements', record.achievements.map((a) => `- ${a.text} ${sourceMd(a.source)}`));
  section('Publications', record.publications.map((p) => `- ${p.title} ${sourceMd(p.source)}`));
  section('Open-source contributions', record.contributions.map((c) => `- ${c.text} ${sourceMd(c.source)}`));
  if (record.sameAs.length) section('Elsewhere', record.sameAs.map((url) => `- <${url}>`));
  return out.join('\n');
}
