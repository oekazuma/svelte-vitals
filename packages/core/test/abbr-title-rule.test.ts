import { describe, it, expect } from 'vitest';
import { a11yAbbrTitle } from '../src/rules/a11y/abbr-title.js';
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
  const results = await a11yAbbrTitle.check(ctx([comp('src/routes/+page.svelte', src)]));
  return results.filter((r) => r.detection.presence === 'none');
};

describe('a11y/abbr-title', () => {
  it('flags an <abbr> without a title at info severity', async () => {
    const failing = await check('<abbr>HTML</abbr>');
    expect(failing).toHaveLength(1);
    expect(failing[0]!.severity).toBe('info');
    expect(failing[0]!.line).toBe(1);
    expect(failing[0]!.message).toBe('<abbr> without a title gives readers no expansion of the abbreviation');
  });

  it('flags a blank literal title and a bare title — neither carries an expansion', async () => {
    expect(await check('<abbr title="">HTML</abbr>')).toHaveLength(1);
    expect(await check('<abbr title>HTML</abbr>')).toHaveLength(1);
  });

  it('passes a literal expansion and an expression title', async () => {
    expect(await check('<abbr title="HyperText Markup Language">HTML</abbr>')).toEqual([]);
    expect(await check('<abbr title={expansion}>HTML</abbr>')).toEqual([]);
  });

  it('skips a spread-carrying <abbr> — its rendered attributes are unknowable', async () => {
    expect(await check('<abbr {...rest}>HTML</abbr>')).toEqual([]);
  });

  it('skips an <abbr> inside <svg> — it is not an SVG element', async () => {
    expect(await check('<svg><abbr>SVG</abbr></svg>')).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'a11y/abbr-title')).toBe(true);
    expect(explainRule('a11y/abbr-title')?.severity).toBe('info');
  });
});
