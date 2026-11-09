import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * The content hash of an Original's revision: its source file, line endings normalised.
 * A Translation records it as `translatedFrom`; when the Original's hash moves on, the
 * Translation is outdated. Shared by the build and `pnpm translation:hash`.
 */
export function originalHash(filePath) {
  const source = readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n');
  return createHash('sha256').update(source).digest('hex').slice(0, 12);
}
