import type { APIRoute, GetStaticPaths } from 'astro';
import { figuresOf, getProjects, legalOf, linksOf, metadataOf, type Project } from '../../lib/projects';

export const getStaticPaths = (async () => {
  const projects = await getProjects();
  return projects.map((project) => ({ params: { slug: project.id }, props: { project } }));
}) satisfies GetStaticPaths;

const yamlString = (value: string) => JSON.stringify(value);

export const GET: APIRoute<{ project: Project }> = async ({ props: { project } }) => {
  const meta = metadataOf(project);
  const links = linksOf(project);
  const legal = await legalOf(project);
  const figures = await figuresOf(project);
  const frontMatter = [
    '---',
    `title: ${yamlString(meta.title)}`,
    `summary: ${yamlString(meta.summary)}`,
    `published: ${meta.published}`,
    `updated: ${meta.updated}`,
    `language: ${meta.language}`,
    `tags: [${meta.tags.map(yamlString).join(', ')}]`,
    `canonical: ${meta.canonical}`,
    `status: ${meta.status}`,
    ...(meta.version ? [`version: ${yamlString(meta.version)}`] : []),
    '---',
  ].join('\n');
  const sections = [
    `# ${meta.title}`,
    meta.summary,
    `Status: ${meta.status}${meta.version ? `. Version: ${meta.version}` : ''}.`,
    (project.body ?? '').trim(),
    figures.map((figure) => `![${figure.alt}](${figure.src})${figure.caption ? `\n\n${figure.caption}` : ''}`).join('\n\n'),
    links.length ? `## Links\n\n${links.map((link) => `- [${link.label}](${link.url})`).join('\n')}` : '',
    legal.length ? `## Legal documents\n\n${legal.map((doc) => `- [${doc.title}](${doc.path})`).join('\n')}` : '',
  ];
  return new Response(`${frontMatter}\n\n${sections.filter(Boolean).join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
