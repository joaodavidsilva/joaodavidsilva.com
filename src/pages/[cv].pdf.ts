import type { APIRoute, GetStaticPaths } from 'astro';
import { cvPdf } from '../lib/cv';
import { getRecord, type Record } from '../lib/record';

// A dynamic route so the CV exists only when the content set has a record.
export const getStaticPaths = (async () => {
  const record = await getRecord();
  return record ? [{ params: { cv: 'cv' }, props: { record } }] : [];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(await cvPdf((props as { record: Record }).record), {
    headers: { 'Content-Type': 'application/pdf' },
  });
