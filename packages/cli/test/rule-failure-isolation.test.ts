import { describe, it, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');

const THROWN_MESSAGE = 'synthetic rule failure (test)\nwith a second line a warning must not print';

// Replaces one real rule's `check` with a throwing stub, keeping the rest of the registry (and
// every other export) untouched — the smallest way to prove `run()` survives a crashed rule
// end-to-end without hand-rolling a fake analysis pipeline.
vi.mock('@svelte-vitals/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@svelte-vitals/core')>();
  const allRules = actual.allRules.map((rule) =>
    rule.id === 'seo/title-presence'
      ? {
          ...rule,
          check: async () => {
            throw new Error(THROWN_MESSAGE);
          }
        }
      : rule
  );
  return { ...actual, allRules };
});

const { run, analyzeProject } = await import('../src/index.js');

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, log: (line: string) => out.push(line), errorLog: (line: string) => err.push(line) };
}

describe('rule-failure isolation (audit 2608-CORE-06)', () => {
  it('a crashed rule does not kill the run: a clean run with only the crashed rule selected exits 0', async () => {
    const cap = capture();
    // --rules restricts the run to exactly the crashed rule, so nothing else can contribute a
    // finding — isolating whether the crash itself changes the exit code.
    const code = await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: {},
      allowRules: ['seo/title-presence']
    });
    expect(code).toBe(0);
  });

  it('warns on stderr with the rule id and only the first line of its message', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, env: {}, allowRules: ['seo/title-presence'] });
    expect(cap.err).toContainEqual(
      'svelte-vitals: rule seo/title-presence failed and was skipped: synthetic rule failure (test)'
    );
    expect(cap.err.some((l) => l.includes('with a second line'))).toBe(false);
  });

  it('analyzeProject returns the crashed rule id in failedRuleIds', async () => {
    const result = await analyzeProject({ cwd: fixtureDir, allowRules: ['seo/title-presence'] });
    expect(result.failedRuleIds).toEqual(['seo/title-presence']);
  });
});
