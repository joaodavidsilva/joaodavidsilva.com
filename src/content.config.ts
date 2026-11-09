import { defineCollection, reference } from 'astro:content';
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
    ...translatable,
    tags: z.array(z.string()).default([]),
  }),
});

// A Project: something João maintains over time. `content/projects/<slug>.md` is `/projects/<slug>/`.
// Projects are Originals; they have no Translations yet.
const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: `${contentDir}/projects` }),
  schema: ({ image }) =>
    z.object({
      name: z.string().min(1),
      oneLine: z.string().min(1),
      status: z.enum(['active', 'in development', 'paused', 'archived']),
      version: z.string().min(1).optional(),
      published: z.coerce.date(),
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

/** An https URL on one of `hosts`, such as a post on LinkedIn or X. */
const postOn = (network: string, hosts: string[]) =>
  z.url({ protocol: /^https$/ }).refine((url) => hosts.includes(new URL(url).hostname), {
    error: `must be an https URL on ${network} (${hosts.join(', ')})`,
  });

// One Markdown file per Article: `articles/<slug>.md`, published at `/writing/<slug>/`.
// Its own folder, `articles/<slug>/`, holds its images and attachments and is
// published beside it at `/writing/<slug>/`. Strict, so a misspelt field fails the build.
// Articles are English Originals.
const articles = defineCollection({
  loader: glob({ pattern: '*.md', base: `${contentDir}/articles` }),
  schema: z.strictObject({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    language: z.literal('en').default('en'),
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

export const collections = { pages, projects, knowledge, articles, record };
