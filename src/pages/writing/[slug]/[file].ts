import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { getArticles } from '../../../lib/articles';
import { folderFilesOf } from '../../../lib/own-folder';

// An Article's own folder (its images and attachments) is published beside it, at `/writing/<slug>/<file>`.
export const getStaticPaths = (async () => {
  const articles = await getArticles();
  return articles.flatMap((article) =>
    folderFilesOf(article).map(({ file, source }) => ({ params: { slug: article.id, file }, props: { source } })),
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ source: string }> = ({ props }) => new Response(readFileSync(props.source));
