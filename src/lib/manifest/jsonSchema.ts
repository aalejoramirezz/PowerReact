import { manifestJsonSchema } from './schema';

/** Where the published JSON Schema lives (served at /manifests/manifest.schema.json). */
export const MANIFEST_SCHEMA_FILE = 'public/manifests/manifest.schema.json';

/**
 * The JSON Schema document Univerus-Lens validates manifests against, generated from the Zod
 * schema (refinements such as "exactly one EVALUATE" and unique ids are checked by PowerReact).
 */
export function manifestSchemaDocument(): string {
  const { $schema, ...schema } = manifestJsonSchema();
  const document = {
    $schema,
    $id: 'https://powerreact.local/manifests/manifest.schema.json',
    title: 'PowerReact report manifest',
    description:
      'A report rendered by PowerReact with the Univerus web components: data source, 12-column grid and visuals (DAX query, field mappings, presentation props). Generated from src/lib/manifest/schema.ts by `npm run manifest:schema`.',
    ...schema,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}
