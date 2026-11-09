// Prints the `translatedFrom` value (quoted: an all-digit hash would read as a YAML number) for a Translation of each Original given.
// Usage: pnpm translation:hash content/pages/privacy.md
import { originalHash } from '../src/lib/original-hash.mjs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: pnpm translation:hash <original.md>...');
  process.exit(1);
}
for (const file of files) console.log(`${file}: translatedFrom: "${originalHash(file)}"`);
