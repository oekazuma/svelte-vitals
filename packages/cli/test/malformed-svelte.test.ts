import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Runtime } from '@svelte-vitals/core';
import { run } from '../src/index.js';
import { collectComponentFacts } from '../src/providers/source/components.js';
import { createNodeRuntime } from '../src/runtime/node.js';

const here = dirname(fileURLToPath(import.meta.url));
const malformedComponentProject = join(here, 'fixtures', 'malformed-component-project');
const malformedRouteProject = join(here, 'fixtures', 'malformed-route-project');
// Isolate reporter auto-detection from the ambient test-runner environment
// (e.g. CLAUDECODE is set when running inside Claude Code) — mirrors run.test.ts.
const CLEAN_ENV: NodeJS.ProcessEnv = {};

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    log: (line: string) => out.push(line),
    errorLog: (line: string) => err.push(line)
  };
}

describe('collectComponentFacts: malformed .svelte files (component path)', () => {
  it('returns empty facts for a component that fails to parse, without throwing', async () => {
    // This empty-facts fallback is an intentional contract of components.ts (dev
    // tooling must never throw): a syntax error in one component must not prevent
    // facts from being collected for the rest of the project.
    const rt = createNodeRuntime();
    const facts = await collectComponentFacts(rt, malformedComponentProject);
    const byFile = new Map(facts.map((f) => [f.file, f]));

    const broken = byFile.get('src/lib/Broken.svelte');
    expect(broken).toBeDefined();
    expect(broken).toEqual({
      file: 'src/lib/Broken.svelte',
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
      orphanEffects: [],
      orphanLifecycleCalls: [],
      moduleStateDecls: [],
      suppressions: []
    });

    // The well-formed sibling file must still be parsed normally — one broken
    // file must not degrade facts collection for the rest of the project.
    const page = byFile.get('src/routes/+page.svelte');
    expect(page).toBeDefined();
    expect(page!.loc).toBeGreaterThan(0);
  });

  it('run() completes for a project with a broken component, and does not exit 2', async () => {
    // The component-facts pass swallows the parse failure, so a broken $lib
    // component must not abort the whole analysis (unlike a broken route file —
    // see the route-path cases below).
    const cap = capture();
    const code = await run({ cwd: malformedComponentProject, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).not.toBe(2);
    expect([0, 1]).toContain(code);
  });

  it('returns empty facts when the file cannot even be read (not just a parse failure)', async () => {
    // Same intentional contract as above, exercised through the catch branch's
    // other entry point: readFile rejecting (e.g. a permissions error or a race
    // with a deleted file), not just parseComponentFacts throwing.
    const unreadablePath = 'src/lib/Unreadable.svelte';
    const goodPath = 'src/routes/+page.svelte';
    const rt: Runtime = {
      async readFile(path) {
        if (path.endsWith(unreadablePath)) throw new Error('EACCES: permission denied');
        return '<svelte:head><title>t</title></svelte:head>';
      },
      async exists() {
        return true;
      },
      async glob() {
        return [unreadablePath, goodPath];
      },
      join(...parts) {
        return parts.filter((p) => p.length > 0).join('/');
      }
    };

    const facts = await collectComponentFacts(rt, '');
    const byFile = new Map(facts.map((f) => [f.file, f]));

    expect(byFile.get(unreadablePath)).toEqual({
      file: unreadablePath,
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
      orphanEffects: [],
      orphanLifecycleCalls: [],
      moduleStateDecls: [],
      suppressions: []
    });
    expect(byFile.get(goodPath)!.loc).toBeGreaterThan(0);
  });
});

describe('run(): malformed .svelte files (route path)', () => {
  it('exits 2 when a route file (+page.svelte) fails to parse', async () => {
    // Unlike the component path above, resolveRoute() in routes.ts has no
    // try/catch: a syntax error in a +page.svelte/+layout.svelte propagates out of
    // collectRoutes() -> analyzeProject() and is caught by run()'s top-level catch,
    // which maps it to exit 2 (execution error) — aborting the ENTIRE analysis, not
    // just the one broken route.
    //
    // This asymmetry between the route path (abort everything) and the component
    // path (skip just the broken file) is known and currently intentional per
    // plans/002. If this test starts failing because routes.ts grew a catch, that
    // is a deliberate behavior change — update this test (and plans/002) to match,
    // don't just silence the failure.
    const cap = capture();
    const code = await run({ cwd: malformedRouteProject, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).toBe(2);
    expect(cap.err.join('\n')).toMatch(/^svelte-vitals:/);
  });
});
