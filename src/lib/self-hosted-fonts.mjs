import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Astro font provider serving the installed `@fontsource-variable/*` packages: the font
 * files ship with the build, so every font request stays on the site's own origin and
 * builds never touch the network. Unlike the built-in `npm` provider it serves italics
 * and tags each face with its subset, so `<Font preload>` can preload Latin files only.
 */
export function fontsourceVariable() {
  return {
    name: 'fontsource-variable',
    resolveFont({ familyName, styles, subsets }) {
      const id = familyName.toLowerCase().replaceAll(' ', '-');
      const dir = dirname(require.resolve(`@fontsource-variable/${id}`));
      const read = (file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const { wght } = read('metadata.json').variable;
      const ranges = read('unicode.json');
      const fonts = styles.flatMap((style) =>
        subsets.map((subset) => ({
          src: [{ url: join(dir, 'files', `${id}-${subset}-wght-${style}.woff2`), format: 'woff2' }],
          weight: [Number(wght.min), Number(wght.max)],
          style,
          unicodeRange: ranges[subset].split(','),
          meta: { subset },
        })),
      );
      return { fonts };
    },
  };
}
