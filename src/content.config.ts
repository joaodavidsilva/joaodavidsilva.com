import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { KNOWLEDGE_CATEGORIES } from '../site.config.mjs';

// JDS_CONTENT_DIR lets the fixture build tests swap in their own content set.
const contentDir = process.env.JDS_CONTENT_DIR ?? './content';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentDir}/pages` }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    language: z.enum(['en', 'pt']).default('en'),
    tags: z.array(z.string()).default([]),
  }),
});

const knowledge = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentDir}/knowledge` }),
  schema: z
    .object({
      kind: z.enum(['concept', 'guide']),
      title: z.string().min(1),
      summary: z.string().min(1),
      category: z.enum(KNOWLEDGE_CATEGORIES as [string, ...string[]]),
      tags: z.array(z.string()).default([]),
      language: z.enum(['en', 'pt']).default('en'),
      /** Ids of related entries (Concept cross-references). */
      related: z.array(z.string()).default([]),
      /** Name of the Skill in the skills repo that applies this Guide. */
      skill: z.string().min(1).optional(),
    })
    .refine((entry) => entry.kind === 'guide' || entry.skill === undefined, {
      message: 'only Guides may reference a skill',
      path: ['skill'],
    }),
});

export const collections = { pages, knowledge };
