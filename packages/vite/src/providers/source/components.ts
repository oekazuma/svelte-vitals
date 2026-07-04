import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'tinyglobby';
import { parseComponentFacts, type ComponentFacts } from '@svelte-vitals/core';

/**
 * Scan every `.svelte` component under `src/` for Correctness/Security/Architecture/
 * Bundle-Performance facts (build mode only). Mirrors the CLI's `collectComponentFacts`,
 * but implemented directly against `node:fs` + `tinyglobby` instead of the CLI's
 * injectable `Runtime` — vite always runs in Node, so no swappable runtime is needed.
 */
export async function collectComponentFacts(root: string): Promise<ComponentFacts[]> {
  const files = await glob('src/**/*.svelte', { cwd: root, dot: false });
  return Promise.all(
    files.sort().map(async (rel): Promise<ComponentFacts> => {
      try {
        const source = await readFile(join(root, rel), 'utf8');
        return { file: rel, ...parseComponentFacts(source, rel) };
      } catch {
        return {
          file: rel,
          eachBlocks: [],
          effects: [],
          htmlTags: [],
          javascriptUrls: [],
          loc: 0,
          propCount: 0,
          imports: [],
          namespaceImports: [],
          constableStates: [],
          suppressions: []
        };
      }
    })
  );
}
