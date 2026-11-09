import { defineCollection, reference } from 'astro:content';
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

// A Project: something João maintains over time. `content/projects/<slug>.md` is `/projects/<slug>/`.
const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: `${process.env.JDS_CONTENT_DIR ?? './content'}/projects` }),
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

export const collections = { pages, projects };
