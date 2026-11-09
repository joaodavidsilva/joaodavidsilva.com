import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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

export const collections = { pages };
