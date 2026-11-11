import { z } from 'astro/zod';
import { SITE_URL } from '../../site.config.mjs';
import { translatable } from './translations';

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

// The CV publishes the email, so it must be on the site's own domain, never a personal mailbox.
const domain = new URL(SITE_URL).hostname;
const domainEmail = z.email().refine((email) => email.endsWith(`@${domain}`), { message: `must be an address @${domain}` });

const month = z.string().regex(/^\d{4}-\d{2}$/, 'a month like 2024-01');

// Strict objects: unknown fields (phone, address, …) fail the build.
export const recordSchema = z.strictObject({
  ...translatable,
  name: text,
  headline: text,
  url: z.url(),
  email: domainEmail.optional(),
  // City and country only, never a postal address: recruiters filter by where a candidate can work.
  // Street numbers and postcodes carry digits; street names start with words like these.
  location: text
    .refine((value) => !/\d|(?<!\p{L})(rua|avenida|av\.|travessa|largo|praça|street|st\.|road|rd\.|avenue|lane)(?!\p{L})/iu.test(value), {
      message: 'city and country only, like "Lisbon, Portugal": never a street, number or postcode',
    })
    .optional(),
  languages: z.array(text).default([]),
  // João's own prose: opinions, not Claims, so they carry no source. Blank lines separate paragraphs.
  interests: text.optional(),
  approach: text.optional(),
  sameAs: z.array(z.url()).default([]),
  roles: z
    .array(
      z.strictObject({
        title: text,
        organisation: text,
        start: month,
        end: month.optional(),
        // What João did in the role. A plain line rests on the role's source; a line with its own
        // source (a number the role's source does not show, say) cites it.
        highlights: z.array(z.union([text, z.strictObject({ text, source })])).default([]),
        // The technologies used in the role, most relevant first; they rest on the role's source.
        stack: z.array(text).default([]),
        source,
      }),
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
export type ProfessionalRecord = z.infer<typeof recordSchema>;
