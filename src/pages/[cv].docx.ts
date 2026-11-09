import type { APIRoute, GetStaticPaths } from 'astro';
import { cvDocx } from '../lib/cv';
import { getRecord, type ProfessionalRecord } from '../lib/record';

// A dynamic route so the CV exists only when the content set has a record.
export const getStaticPaths = (async () => {
  const record = await getRecord();
  return record ? [{ params: { cv: 'cv' }, props: { record } }] : [];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(await cvDocx((props as { record: ProfessionalRecord }).record), {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  });
