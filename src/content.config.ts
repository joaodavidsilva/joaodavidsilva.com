import { defineCollection, reference } from 'astro:content';
import { existsSync } from 'node:fs';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { KNOWLEDGE_CATEGORIES, LANGUAGES, WAITLISTS } from '../site.config.mjs';
import { recordSchema } from './lib/record-schema';
import { translatable, withTranslations } from './lib/translations';

// Every collection is translatable (ADR-0005): a Translation is a file at its Original's path
// under `<language>/` in the same collection, with `translatable` front-matter.

// JDS_CONTENT_DIR lets the fixture build tests swap in their own content set.
const contentDir = process.env.JDS_CONTENT_DIR ?? './content';

// Collections are strict: an unknown or misspelt front-matter field fails the build.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentDir}/pages` }),
  schema: z.strictObject({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    ...translatable,
    // A legal document: its Translations must never be outdated.
    legal: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

// A Project: something João maintains over time. `content/projects/<slug>.md` is `/projects/<slug>/`.
const projects = defineCollection({
  loader: glob({ pattern: withTranslations('*.md'), base: `${contentDir}/projects` }),
  schema: ({ image }) =>
    z.strictObject({
      name: z.string().min(1),
      oneLine: z.string().min(1),
      status: z.enum(['active', 'in development', 'paused', 'archived']),
      version: z.string().min(1).optional(),
      published: z.coerce.date(),
      ...translatable,
      tags: z.array(z.string()).default([]),
      links: z
        .strictObject({
          site: z.url().optional(),
          repository: z.url().optional(),
          stores: z.array(z.strictObject({ name: z.string().min(1), url: z.url() })).default([]),
        })
        .default({ stores: [] }),
      // Present when the Project is an application: its page then carries SoftwareApplication JSON-LD.
      software: z
        .strictObject({ category: z.string().min(1), operatingSystems: z.array(z.string().min(1)).min(1) })
        .optional(),
      // Screenshots or diagrams, shown on the Project page and linked from its twin.
      figures: z
        .array(z.strictObject({ src: image(), alt: z.string().min(1), caption: z.string().min(1).optional() }))
        .default([]),
      // Legal documents are pages, so they keep their own URLs.
      legal: z.array(reference('pages')).default([]),
      // The Waitlist the Project page offers, by the `source` the Waitlist Worker stores (ADR-0004).
      waitlist: z.enum(Object.keys(WAITLISTS) as [string, ...string[]]).optional(),
    }),
});

const knowledge = defineCollection({
  loader: glob({ pattern: withTranslations('*.md'), base: `${contentDir}/knowledge` }),
  schema: z
    .strictObject({
      kind: z.enum(['concept', 'guide']),
      title: z.string().min(1),
      summary: z.string().min(1),
      published: z.coerce.date(),
      category: z.enum(KNOWLEDGE_CATEGORIES as [string, ...string[]]),
      tags: z.array(z.string()).default([]),
      ...translatable,
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

// A Series: `series/<slug>.md`, published at `/writing/series/<slug>/`. Its body is the
// introduction; its parts are the Articles that name it in `series`, ordered by `part`.
const series = defineCollection({
  loader: glob({ pattern: withTranslations('*.md'), base: `${contentDir}/series` }),
  schema: z.strictObject({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    ...translatable,
    status: z.enum(['ongoing', 'complete']),
  }),
});

// One Markdown file per Article: `articles/<slug>.md`, published at `/writing/<slug>/`.
// Its own folder, `articles/<slug>/`, holds its images and attachments and is
// published beside it at `/writing/<slug>/`. Strict, so a misspelt field fails the build.
// A part of a Series names it in `series` with its `part` number.
const articles = defineCollection({
  loader: glob({ pattern: withTranslations('*.md'), base: `${contentDir}/articles` }),
  schema: z.strictObject({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    ...translatable,
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
    series: reference('series').optional(),
    part: z.number().int().positive().optional(),
  }).refine((article) => (article.series === undefined) === (article.part === undefined), {
    error: 'a part of a Series sets both `series` and `part`',
    path: ['part'],
  }),
});

/** A Study's link to its data or a script: a file in its own folder, or an https URL elsewhere. */
const studyLink = z.union([
  z.strictObject({
    title: z.string().min(1),
    file: z.string().regex(/^[\w.-]+$/, "must be a file name in the Study's own folder"),
  }),
  z.strictObject({ title: z.string().min(1), url: z.url({ protocol: /^https$/ }) }),
]);

// One Markdown file per Study: `studies/<slug>.md`, published at `/research/<slug>/`, its own
// folder `studies/<slug>/` beside it. The body carries the required sections (question,
// hypothesis, method, observations, findings, limitations), checked in src/lib/studies.ts.
const studies = defineCollection({
  loader: glob({ pattern: withTranslations('*.md'), base: `${contentDir}/studies` }),
  schema: z.strictObject({
    title: z.string().min(1),
    summary: z.string().min(1),
    published: z.coerce.date(),
    status: z.enum(['in progress', 'concluded', 'abandoned']),
    ...translatable,
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    updated: z.never({ error: '"last updated" comes from git history; remove this field' }).optional(),
    data: z.array(studyLink).default([]),
    scripts: z.array(studyLink).default([]),
  }),
});

// Now: one dated Markdown entry, `content/now.md`, saying what João is working on; its
// Translations are `content/<language>/now.md`.
const now = defineCollection({
  loader: glob({ pattern: withTranslations('now.md'), base: contentDir }),
  schema: z.strictObject({ date: z.coerce.date(), ...translatable }),
});

// The Professional record: one YAML file whose single `record` entry is João's verified profile.
// Its Translations are `content/<language>/record.yaml`, entry `<language>/record`.
const record = defineCollection({
  loader: {
    name: 'record',
    load: async (context) => {
      context.store.clear();
      for (const prefix of ['', ...Object.keys(LANGUAGES).filter((code) => code !== 'en').map((code) => `${code}/`)]) {
        const recordFile = `${contentDir}/${prefix}record.yaml`;
        if (!existsSync(recordFile)) continue;
        // The file loader clears its store before adding the entry, so it gets one of its own.
        const store = { clear() {}, set: (entry: { id: string }) => context.store.set({ ...entry, id: `${prefix}${entry.id}` } as never) };
        await file(recordFile).load({ ...context, store: store as never });
      }
    },
  },
  schema: recordSchema,
});

export const collections = { pages, now, projects, knowledge, articles, series, studies, record };
