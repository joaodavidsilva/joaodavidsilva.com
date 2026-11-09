import type { APIRoute, GetStaticPaths } from 'astro';
import { getPages, metadataOf, translationsOf, twinPathOf, type Page } from '../lib/pages';
import { homeMarkdown } from '../lib/home';
import { originalIdOf, translationFields, type Translations } from '../lib/translations';
import { markdownResponse } from '../lib/twin';

export const getStaticPaths = (async () => {
  const pages = await getPages();
  return pages.map((page) => ({
    params: { slug: twinPathOf(page).slice(1, -'.md'.length) },
    props: { page, translations: translationsOf(page, pages) },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { page, translations } = props as { page: Page; translations: Translations };
  const meta = metadataOf(page);
  return markdownResponse({ ...meta, ...translationFields(translations) }, [
    `# ${meta.title}`,
    (page.body ?? '').trim(),
    originalIdOf(page) === 'index' && (await homeMarkdown(meta.language)),
  ]);
};
