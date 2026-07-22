import { parseComponentFacts } from './component-parse.js';
import type { ComponentFacts } from './component.js';
import type { Runtime } from './runtime.js';

/**
 * Fallback facts for a file that fails to read or parse (dev tooling must never
 * throw). This is the single source of truth for the empty-facts shape — add new
 * `ComponentFacts` fields HERE so TypeScript catches every call site that still
 * needs updating.
 */
export function emptyComponentFacts(file: string): ComponentFacts {
  return {
    file,
    eachBlocks: [],
    effects: [],
    htmlTags: [],
    javascriptUrls: [],
    loc: 0,
    propCount: 0,
    imports: [],
    importSpans: [],
    namespaceImports: [],
    constableStates: [],
    mutatedProps: [],
    stalePropDerivations: [],
    orphanEffects: [],
    orphanLifecycleCalls: [],
    browserGlobalRefs: [],
    moduleStateDecls: [],
    suppressions: []
  };
}

/**
 * Scan every `.svelte` component and `.svelte.ts`/`.svelte.js` runes module under `src/`
 * for Correctness/Security/Architecture/Bundle-Performance facts. Independent of route
 * resolution — covers `$lib` and non-route components too. A file that fails to read or
 * parse contributes empty facts instead of aborting the whole scan (dev tooling must
 * never throw).
 */
export async function collectComponentFacts(rt: Runtime, cwd: string): Promise<ComponentFacts[]> {
  // One brace pattern = one directory traversal (Runtime.glob implementations use
  // picomatch-style matching); dedupe is unnecessary for a single pattern.
  const files = await rt.glob('src/**/*.svelte{,.ts,.js}', cwd);
  return Promise.all(
    files.sort().map(async (rel): Promise<ComponentFacts> => {
      try {
        const source = await rt.readFile(rt.join(cwd, rel));
        return { file: rel, ...parseComponentFacts(source, rel) };
      } catch {
        return emptyComponentFacts(rel);
      }
    })
  );
}
