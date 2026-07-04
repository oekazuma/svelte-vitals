import type { ComponentFacts, Runtime } from '@svelte-vitals/core';
import { parseComponentFacts } from './parse.js';

/**
 * Scan every `.svelte` component under `src/` for Correctness facts (#correctness).
 * Independent of route resolution — covers `$lib` and non-route components too. A
 * file that fails to parse contributes no facts (dev tooling must never throw).
 */
export async function collectComponentFacts(rt: Runtime, cwd: string): Promise<ComponentFacts[]> {
  const files = await rt.glob('src/**/*.svelte', cwd);
  return Promise.all(
    files.sort().map(async (rel): Promise<ComponentFacts> => {
      try {
        const source = await rt.readFile(rt.join(cwd, rel));
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
