import type { APIRoute } from 'astro';
import { byCategory, getKnowledge, markdownList } from '../lib/knowledge';
import { SITE_URL } from '../../site.config.mjs';

export const GET: APIRoute = async () => {
  const groups = byCategory(await getKnowledge());
  const body = [
    '---',
    'title: "Knowledge"',
    'summary: "Concepts and Guides on engineering with and for AI agents, by category."',
    'language: en',
    `canonical: ${new URL('/knowledge/', SITE_URL).href}`,
    '---',
    '',
    '# Knowledge',
    ...groups.flatMap((group) => ['', `## ${group.category}`, '', markdownList(group.entries)]),
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
