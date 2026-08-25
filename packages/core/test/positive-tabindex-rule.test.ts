import { describe, it, expect } from 'vitest';
import { a11yPositiveTabindex } from '../src/rules/a11y/positive-tabindex.js';
import { parseComponentFacts } from '../src/component-parse.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, src: string): ComponentFacts {
  return { ...emptyComponentFacts(file), ...parseComponentFacts(src, file) };
}

const check = async (src: string) => {
  const results = await a11yPositiveTabindex.check(ctx([comp('src/routes/+page.svelte', src)]));
  return {
    penalized: results.filter((r) => r.detection.presence === 'none'),
    passed: results.filter((r) => r.detection.presence !== 'none')
  };
};

describe('a11y/positive-tabindex', () => {
  it('flags a positive tabindex at warning severity', async () => {
    const { penalized } = await check('<div tabindex="1">first</div>');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.line).toBe(1);
    expect(penalized[0]!.message).toBe(
      'tabindex="1" on <div> hijacks the tab order for the whole page — only 0 and -1 are safe values'
    );
  });

  it('flags each offending element independently', async () => {
    const { penalized } = await check('<div tabindex="2">a</div>\n<button tabindex="3">b</button>');
    expect(penalized).toHaveLength(2);
    expect(penalized.map((r) => r.line)).toEqual([1, 2]);
  });

  it('passes tabindex="0" and tabindex="-1"', async () => {
    const { penalized, passed } = await check('<div tabindex="0">a</div>\n<div tabindex="-1">b</div>');
    expect(penalized).toEqual([]);
    expect(passed).toHaveLength(1);
  });

  it('skips an expression-valued tabindex — unknowable', async () => {
    const { penalized, passed } = await check('<div tabindex={t}>a</div>');
    expect(penalized).toEqual([]);
    expect(passed).toEqual([]);
  });

  it('emits nothing for a blank or unparsable tabindex — it neither penalizes nor seeds a pass', async () => {
    const { penalized, passed } = await check('<div tabindex="">a</div>\n<div tabindex="x">b</div>');
    expect(penalized).toEqual([]);
    expect(passed).toEqual([]);
  });

  it('pins the shared Number() parse: compiler-aligned verdicts on exotic values', async () => {
    // Flagged: Number() parses these above 0 (matching the Svelte compiler's check),
    // even where HTML's leading-integer parse would differ (0x10 → 0 in a browser).
    const flagged = await check(
      [
        '<div tabindex="0x10">a</div>',
        '<div tabindex="1e2">b</div>',
        '<div tabindex="1.5">c</div>',
        '<div tabindex=" 2 ">d</div>'
      ].join('\n')
    );
    expect(flagged.penalized.map((r) => r.line)).toEqual([1, 2, 3, 4]);
    // Skipped/passing: Infinity is not finite; -0 and 1abc parse to a non-positive or no value.
    const quiet = await check(
      ['<div tabindex="Infinity">a</div>', '<div tabindex="-0">b</div>', '<div tabindex="1abc">c</div>'].join('\n')
    );
    expect(quiet.penalized).toEqual([]);
  });

  it('emits nothing for a component without tabindex', async () => {
    const { penalized, passed } = await check('<div>a</div>');
    expect(penalized).toEqual([]);
    expect(passed).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'a11y/positive-tabindex')).toBe(true);
    expect(explainRule('a11y/positive-tabindex')?.severity).toBe('warning');
  });
});
