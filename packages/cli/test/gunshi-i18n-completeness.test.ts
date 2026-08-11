// ja `--help` design (docs/superpowers/specs/2026-08-11-cli-ja-help-design.md): a missing ja arg
// description is a red build, not a silent English leak. Expected keys are enumerated from the
// LIVE arg declarations (never a second hand-maintained inventory) — one map per surface that
// actually feeds a `generate()` call for `--help` (see `locales/ja.ts`'s own doc comment for why
// that's `ROOT_ARGS`/`DOCS_ROOT_ARGS`/`EXPLAIN_ARGS`/`INSTALL_ARGS`/`CI_ARGS`, not every exported
// `*_ARGS` const — `DOCS_LIST_ARGS`/`DOCS_SHOW_ARGS`/`CI_UPGRADE_ARGS` are never passed to
// `generate()`, so they have nothing to translate for this feature).
import { describe, it, expect } from 'vitest';
import { ROOT_ARGS } from '../src/gunshi/analyze.js';
import { DOCS_ROOT_ARGS } from '../src/gunshi/docs.js';
import { EXPLAIN_ARGS } from '../src/gunshi/explain.js';
import { INSTALL_ARGS } from '../src/gunshi/install.js';
import { CI_ARGS } from '../src/gunshi/ci.js';
import { JA_ARG_DESCRIPTIONS } from '../src/gunshi/locales/ja.js';

const LIVE_SURFACES: Record<keyof typeof JA_ARG_DESCRIPTIONS, Record<string, { type: string; hidden?: boolean }>> = {
  root: ROOT_ARGS,
  docs: DOCS_ROOT_ARGS,
  explain: EXPLAIN_ARGS,
  install: INSTALL_ARGS,
  ci: CI_ARGS
};

/** Hidden args never reach `--help`'s OPTIONS block (gunshi's own renderer skips them, same as
 * `--help`/the completion tree/the cli-reference table) — nothing to translate for one. */
function visibleKeys(args: Record<string, { type: string; hidden?: boolean }>): string[] {
  return Object.entries(args)
    .filter(([, schema]) => !schema.hidden)
    .map(([key]) => key)
    .sort();
}

describe('ja help resource completeness (drift test)', () => {
  for (const [surface, liveArgs] of Object.entries(LIVE_SURFACES)) {
    it(`${surface}: ja description keys exactly match the live declaration (no missing, no extra)`, () => {
      const expected = visibleKeys(liveArgs);
      const actual = Object.keys(JA_ARG_DESCRIPTIONS[surface as keyof typeof LIVE_SURFACES]).sort();
      expect(
        actual,
        `src/gunshi/locales/ja.ts's JA_ARG_DESCRIPTIONS.${surface} is out of sync with the live declaration`
      ).toEqual(expected);
    });
  }

  it('no ja description is blank', () => {
    for (const [surface, map] of Object.entries(JA_ARG_DESCRIPTIONS)) {
      for (const [key, text] of Object.entries(map)) {
        expect(text.trim(), `${surface}.${key}`).not.toBe('');
      }
    }
  });

  // The five surface names double as the "prose registry": every surface with an arg-description
  // map above also has its own ja prose builder — a missing one is a compile error (the surface
  // file's build*HelpText imports it by name), so this is a lightweight sanity check that each
  // actually produces non-empty ja text, not the primary completeness gate for prose.
  it('every surface has a ja prose builder that renders non-empty text', async () => {
    const { rootHelpJa, docsHelpJa, explainHelpJa, installHelpJa, ciHelpJa } =
      await import('../src/gunshi/locales/ja.js');
    expect(rootHelpJa('OPTIONS:')).toContain('svelte-vitals');
    expect(docsHelpJa('OPTIONS:')).toContain('svelte-vitals docs');
    expect(explainHelpJa('OPTIONS:')).toContain('svelte-vitals explain');
    expect(installHelpJa('OPTIONS:')).toContain('svelte-vitals install');
    expect(ciHelpJa('OPTIONS:', '.github/workflows/svelte-vitals.yml')).toContain('svelte-vitals ci');
  });
});
