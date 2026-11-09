import { defineCollection } from 'astro:content';
import { existsSync } from 'node:fs';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { KNOWLEDGE_CATEGORIES, LANGUAGES } from '../site.config.mjs';
import { recordSchema } from './lib/record-schema';

type Language = keyof typeof LANGUAGES;

/**
 * Front-matter every translatable entry carries (ADR-0005). A Translation lives under
 * `/<language>/` at its Original's path and records `translatedFrom`, the hash of the
 * Original's revision it was made from (`pnpm translation:hash <original.md>`), quoted.
 * `legal` marks an Original whose Translations must never be outdated.
 */
const translatable = {
  language: z.enum(Object.keys(LANGUAGES) as [Language, ...Language[]]).default('en'),
  translatedFrom: z.string().regex(/^[0-9a-f]{12}$/).optional(),
  legal: z.boolean().default(false),
};

// JDS_CONTENT_DIR lets the fixture build tests swap in their own content set.
const contentDir = process.env.JDS_CONTENT_DIR ?? './content';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentDir}/pages` }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    ...translatable,
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

// The Professional record: one YAML file whose single `record` entry is João's verified profile.
const recordFile = `${contentDir}/record.yaml`;
const recordLoader = file(recordFile);
const record = defineCollection({
  loader: {
    name: 'record',
    load: async (context) => (existsSync(recordFile) ? recordLoader.load(context) : context.store.clear()),
  },
  schema: recordSchema,
});

export const collections = { pages, knowledge, record };
