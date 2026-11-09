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
    language: z.enum(['en', 'pt']).default('en'),
    tags: z.array(z.string()).default([]),
  }),
});

/** An https URL on one of `hosts`, such as a post on LinkedIn or X. */
const postOn = (network: string, hosts: string[]) =>
  z.url({ protocol: /^https$/ }).refine((url) => hosts.includes(new URL(url).hostname), {
    error: `must be an https URL on ${network} (${hosts.join(', ')})`,
  });

// One Markdown file per Article: `articles/<slug>.md`, published at `/writing/<slug>/`.
// Its own folder, `articles/<slug>/`, holds its images and attachments and is
// published beside it at `/writing/<slug>/`. Strict, so a misspelt field fails the build.
const articles = defineCollection({
  loader: glob({ pattern: '*.md', base: `${process.env.JDS_CONTENT_DIR ?? './content'}/articles` }),
  schema: z.strictObject({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    language: z.enum(['en', 'pt']).default('en'),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    updated: z.never({ error: '"last updated" comes from git history; remove this field' }).optional(),
    attachments: z
      .array(
        z.strictObject({
          file: z.string().regex(/^[\w.-]+$/, 'must be a file name in the Article\'s own folder'),
          title: z.string().min(1),
        }),
      )
      .default([]),
    discuss: z
      .strictObject({
        linkedin: postOn('LinkedIn', ['www.linkedin.com', 'linkedin.com']).optional(),
        x: postOn('X', ['x.com', 'www.x.com']).optional(),
      })
      .default({}),
    corrections: z.array(z.strictObject({ date: z.coerce.date(), note: z.string().min(1) })).default([]),
  }),
});

export const collections = { pages, articles };
