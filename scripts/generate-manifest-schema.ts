/**
 * Writes public/manifests/manifest.schema.json from the Zod schema (src/lib/manifest/schema.ts).
 *
 *   npm run manifest:schema            # regenerate
 *   npm run manifest:schema -- --check # exit 1 when the published file is out of date
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { MANIFEST_SCHEMA_FILE, manifestSchemaDocument } from '../src/lib/manifest/jsonSchema';

const expected = manifestSchemaDocument();
const current = existsSync(MANIFEST_SCHEMA_FILE) ? readFileSync(MANIFEST_SCHEMA_FILE, 'utf8').replace(/\r\n/g, '\n') : null;

if (process.argv.includes('--check')) {
  if (current !== expected) {
    console.error(`OUT OF DATE: ${MANIFEST_SCHEMA_FILE} (run npm run manifest:schema)`);
    process.exit(1);
  }
  console.log(`${MANIFEST_SCHEMA_FILE} is up to date`);
} else {
  writeFileSync(MANIFEST_SCHEMA_FILE, expected);
  console.log(`wrote ${MANIFEST_SCHEMA_FILE}`);
}
