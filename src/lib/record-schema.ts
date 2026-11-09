import { z } from 'astro/zod';

// Free text in the record. Phone numbers never belong in the public repository.
const text = z
  .string()
  .min(1)
  .refine((value) => !/\+?\d[\d ().-]{7,}\d/.test(value), {
    message: 'looks like a phone number; keep phone numbers out of the record',
  });

/** Where a Claim can be checked: a page on this site, an external URL, or private evidence João attests to. */
export const source = z.union([
  z.strictObject({ page: z.string().regex(/^\/(?:[^\s]*\/)?$/, 'an internal page path like /projects/x/') }),
  z.strictObject({ url: z.url() }),
  z.strictObject({ attested: text.describe('where the private evidence is kept') }),
]);

/** Where a skill was demonstrated: something a reader can open, never an attestation. */
const demonstration = z.union([
  z.strictObject({ page: z.string().regex(/^\/(?:[^\s]*\/)?$/) }),
  z.strictObject({ url: z.url() }),
]);

const month = z.string().regex(/^\d{4}-\d{2}$/, 'a month like 2024-01');

// Strict objects: unknown fields (phone, address, …) fail the build.
export const recordSchema = z.strictObject({
  name: text,
  headline: text,
  url: z.url(),
  email: z.email().optional(),
  // João's own prose: opinions, not Claims, so they carry no source. Blank lines separate paragraphs.
  interests: text.optional(),
  approach: text.optional(),
  sameAs: z.array(z.url()).default([]),
  roles: z
    .array(
      z.strictObject({ title: text, organisation: text, start: month, end: month.optional(), source }),
    )
    .default([]),
  projects: z
    .array(z.strictObject({ name: text, summary: text, url: z.url().optional(), source }))
    .default([]),
  skills: z
    .array(
      z.strictObject({
        name: text,
        demonstrated: z.array(demonstration).min(1, 'a skill must point to where it was demonstrated'),
      }),
    )
    .default([]),
  achievements: z.array(z.strictObject({ text, source })).default([]),
  publications: z
    .array(z.strictObject({ title: text, url: z.url().optional(), source }))
    .default([]),
  contributions: z.array(z.strictObject({ text, source })).default([]),
});

export type Source = z.infer<typeof source>;
export type Record = z.infer<typeof recordSchema>;
