import { defineCollection } from 'astro:content';
import { existsSync } from 'node:fs';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { recordSchema } from './lib/record-schema';

// JDS_CONTENT_DIR lets the fixture build tests swap in their own content set.
const base = process.env.JDS_CONTENT_DIR ? `${process.env.JDS_CONTENT_DIR}/pages` : './content/pages';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    language: z.enum(['en', 'pt']).default('en'),
    tags: z.array(z.string()).default([]),
  }),
});

// The Professional record: one YAML file whose single `record` entry is João's verified profile.
const recordFile = `${process.env.JDS_CONTENT_DIR ?? './content'}/record.yaml`;
const recordLoader = file(recordFile);
const record = defineCollection({
  loader: {
    name: 'record',
    load: async (context) => (existsSync(recordFile) ? recordLoader.load(context) : context.store.clear()),
  },
  schema: recordSchema,
});

export const collections = { pages, record };
