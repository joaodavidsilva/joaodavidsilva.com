import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { folderFilesOf } from '../../../lib/own-folder';
import { getStudies } from '../../../lib/studies';

// A Study's own folder (its images, data and scripts) is published beside it, at `/research/<slug>/<file>`.
export const getStaticPaths = (async () => {
  const studies = await getStudies();
  return studies.flatMap((study) =>
    folderFilesOf(study).map(({ file, source }) => ({ params: { slug: study.id, file }, props: { source } })),
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ source: string }> = ({ props }) => new Response(readFileSync(props.source));
