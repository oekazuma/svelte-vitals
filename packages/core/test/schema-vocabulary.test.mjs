import { describe, it, expect } from 'vitest';
import { extractSchemaOrgTypes, resolveSchemaDts } from '../scripts/schema-vocab.mjs';
import { SCHEMA_ORG_TYPES } from '../src/rules/seo/schema-vocabulary.generated.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REGENERATE = 'run `pnpm --filter @svelte-vitals/core run gen:schema-vocab`';
const generatedPath = fileURLToPath(new URL('../src/rules/seo/schema-vocabulary.generated.ts', import.meta.url));

describe('schema-vocabulary: the committed catalog is up to date', () => {
  it('matches a fresh extraction from the installed schema-dts', () => {
    const { dtsPath } = resolveSchemaDts();
    const fresh = new Set(extractSchemaOrgTypes(dtsPath));
    expect(new Set(SCHEMA_ORG_TYPES), REGENERATE).toEqual(fresh);
  });

  it('the header version matches the installed schema-dts version', () => {
    const { version } = resolveSchemaDts();
    const header = readFileSync(generatedPath, 'utf8').split('\n', 1)[0];
    expect(header, REGENERATE).toContain(`schema-dts@${version}`);
  });
});

describe('schema-vocabulary: spot checks', () => {
  it('includes common schema.org types', () => {
    for (const name of ['Article', 'Product', 'BlogPosting', 'WebPage']) {
      expect(SCHEMA_ORG_TYPES.has(name), name).toBe(true);
    }
  });

  it('excludes the schema-dts generic helpers, not just schema.org types', () => {
    for (const name of ['WithContext', 'Graph', 'SchemaValue', 'IdReference']) {
      expect(SCHEMA_ORG_TYPES.has(name), name).toBe(false);
    }
  });
});
