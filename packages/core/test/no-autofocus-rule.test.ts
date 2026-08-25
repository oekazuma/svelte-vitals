import { describe, it, expect } from 'vitest';
import { a11yNoAutofocus } from '../src/rules/a11y/no-autofocus.js';
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
  const results = await a11yNoAutofocus.check(ctx([comp('src/routes/+page.svelte', src)]));
  return {
    penalized: results.filter((r) => r.detection.presence === 'none'),
    passed: results.filter((r) => r.detection.presence !== 'none')
  };
};

describe('a11y/no-autofocus', () => {
  it('flags a bare autofocus at warning severity, anchored at the start tag', async () => {
    const { penalized } = await check('<input\n\tautofocus\n/>');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.line).toBe(1);
    expect(penalized[0]!.message).toBe(
      'autofocus on <input> steals focus when the page loads — keyboard and screen reader users lose their place'
    );
  });

  it('flags a literal-string autofocus — same literal-presence branch as bare', async () => {
    const { penalized } = await check('<input autofocus="autofocus" />');
    expect(penalized).toHaveLength(1);
  });

  it('flags a blank literal autofocus — browsers treat autofocus="" as set', async () => {
    const { penalized } = await check('<input autofocus="" />');
    expect(penalized).toHaveLength(1);
  });

  it('skips an expression-valued autofocus — the expression could be false', async () => {
    const { penalized, passed } = await check('<input autofocus={focusMe} />');
    expect(penalized).toEqual([]);
    expect(passed).toEqual([]);
  });

  it('passes autofocus on a direct child of <dialog> — one-hop parent walk', async () => {
    const { penalized, passed } = await check('<dialog><input autofocus /></dialog>');
    expect(penalized).toEqual([]);
    expect(passed).toHaveLength(1);
  });

  it('passes a deep <dialog> descendant — the walk continues past the first ancestor', async () => {
    const { penalized, passed } = await check('<dialog><div><form><input autofocus /></form></div></dialog>');
    expect(penalized).toEqual([]);
    expect(passed).toHaveLength(1);
  });

  it('passes autofocus on the <dialog> element itself', async () => {
    const { penalized, passed } = await check('<dialog autofocus>hi</dialog>');
    expect(penalized).toEqual([]);
    expect(passed).toHaveLength(1);
  });

  it('passes autofocus inside a popover container — focusing runs on show, not page load', async () => {
    const { penalized, passed } = await check('<div popover="auto"><input autofocus /></div>');
    expect(penalized).toEqual([]);
    expect(passed).toHaveLength(1);
  });

  it('passes when the popover attribute is expression-valued — it could be set, so the carve-out stays generous', async () => {
    const { penalized, passed } = await check('<div popover={mode}><input autofocus /></div>');
    expect(penalized).toEqual([]);
    expect(passed).toHaveLength(1);
  });

  it('reports when a component boundary hides the dialog — the parent chain breaks and dialog cannot be proven', async () => {
    const src = '<script>import Body from "./Body.svelte";</script>\n<dialog><Body><input autofocus /></Body></dialog>';
    const { penalized } = await check(src);
    expect(penalized).toHaveLength(1);
  });

  it('looks through {#if} blocks — logic blocks do not break the ancestor chain', async () => {
    const { penalized, passed } = await check('<dialog>{#if open}<input autofocus />{/if}</dialog>');
    expect(penalized).toEqual([]);
    expect(passed).toHaveLength(1);
  });

  it('ignores a popover attribute on an SVG element — the focusing steps are HTML-only', async () => {
    const { penalized } = await check('<svg popover="auto"><foreignObject><input autofocus /></foreignObject></svg>');
    expect(penalized).toHaveLength(1);
  });

  it('honours a <dialog> inside <foreignObject> — its children are back in the HTML namespace', async () => {
    const { penalized, passed } = await check(
      '<svg><foreignObject><dialog><input autofocus /></dialog></foreignObject></svg>'
    );
    expect(penalized).toEqual([]);
    expect(passed).toHaveLength(1);
  });

  it('emits nothing for a component without autofocus', async () => {
    const { penalized, passed } = await check('<input />');
    expect(penalized).toEqual([]);
    expect(passed).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'a11y/no-autofocus')).toBe(true);
    expect(explainRule('a11y/no-autofocus')?.severity).toBe('warning');
  });
});
