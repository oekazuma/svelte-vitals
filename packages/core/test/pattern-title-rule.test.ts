import { describe, it, expect } from 'vitest';
import { a11yPatternTitle } from '../src/rules/a11y/pattern-title.js';
import { parseComponentFacts } from '../src/component-parse.js';
import { emptyComponentFacts } from '../src/component.js';
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
  const results = await a11yPatternTitle.check(ctx([comp('src/routes/+page.svelte', src)]));
  return results.filter((r) => r.detection.presence === 'none');
};

describe('a11y/pattern-title', () => {
  it('flags a pattern input with no type — the missing type defaults to text, where pattern applies', async () => {
    const failing = await check('<input pattern="[a-z]+" />');
    expect(failing).toHaveLength(1);
    expect(failing[0]!.severity).toBe('info');
    expect(failing[0]!.line).toBe(1);
    expect(failing[0]!.message).toBe(
      '<input pattern> without a title — a failed match tells the user nothing about the expected format'
    );
  });

  it('flags the applies-to types, matched case-insensitively', async () => {
    expect(await check('<input type="email" pattern=".+@example[.]com" />')).toHaveLength(1);
    expect(await check('<input type="TEXT" pattern="[a-z]+" />')).toHaveLength(1);
  });

  it('flags a blank literal title — it describes nothing', async () => {
    expect(await check('<input pattern="[a-z]+" title="" />')).toHaveLength(1);
  });

  it('passes a describing title, literal or expression', async () => {
    expect(await check('<input pattern="[a-z]+" title="Lowercase letters only" />')).toEqual([]);
    expect(await check('<input pattern="[a-z]+" title={hint} />')).toEqual([]);
  });

  it('skips a type where pattern is inert', async () => {
    expect(await check('<input type="number" pattern="[0-9]+" />')).toEqual([]);
  });

  it('skips an expression type or pattern — unknowable', async () => {
    expect(await check('<input type={kind} pattern="[a-z]+" />')).toEqual([]);
    expect(await check('<input pattern={re} />')).toEqual([]);
  });

  it('skips a pattern containing a quantifier brace — Svelte parses {3} as an expression, so the value is dynamic', async () => {
    expect(await check('<input pattern="[A-Za-z]{3}" />')).toEqual([]);
  });

  it('skips a spread-carrying input and an SVG-namespace input', async () => {
    expect(await check('<input pattern="[a-z]+" {...rest} />')).toEqual([]);
    expect(await check('<svg><input pattern="[a-z]+" /></svg>')).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'a11y/pattern-title')).toBe(true);
    expect(explainRule('a11y/pattern-title')?.severity).toBe('info');
  });
});
