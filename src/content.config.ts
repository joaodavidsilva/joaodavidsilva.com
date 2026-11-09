import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LANGUAGES } from '../site.config.mjs';

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
const base = process.env.JDS_CONTENT_DIR ? `${process.env.JDS_CONTENT_DIR}/pages` : './content/pages';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    ...translatable,
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { pages };
