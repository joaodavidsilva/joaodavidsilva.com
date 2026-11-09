import { defineCollection, reference } from 'astro:content';
import { existsSync } from 'node:fs';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { KNOWLEDGE_CATEGORIES } from '../site.config.mjs';
import { recordSchema } from './lib/record-schema';

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

// A Project: something João maintains over time. `content/projects/<slug>.md` is `/projects/<slug>/`.
const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: `${contentDir}/projects` }),
  schema: ({ image }) =>
    z.object({
      name: z.string().min(1),
      oneLine: z.string().min(1),
      status: z.enum(['active', 'in development', 'paused', 'archived']),
      version: z.string().min(1).optional(),
      published: z.coerce.date(),
      updated: z.coerce.date().optional(),
      language: z.enum(['en', 'pt']).default('en'),
      tags: z.array(z.string()).default([]),
      links: z
        .object({
          site: z.url().optional(),
          repository: z.url().optional(),
          stores: z.array(z.object({ name: z.string().min(1), url: z.url() })).default([]),
        })
        .default({ stores: [] }),
      // Present when the Project is an application: its page then carries SoftwareApplication JSON-LD.
      software: z
        .object({ category: z.string().min(1), operatingSystems: z.array(z.string().min(1)).min(1) })
        .optional(),
      // Screenshots or diagrams, shown on the Project page and linked from its twin.
      figures: z
        .array(z.object({ src: image(), alt: z.string().min(1), caption: z.string().min(1).optional() }))
        .default([]),
      // Legal documents are pages, so they keep their own URLs.
      legal: z.array(reference('pages')).default([]),
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

export const collections = { pages, projects, knowledge, record };
