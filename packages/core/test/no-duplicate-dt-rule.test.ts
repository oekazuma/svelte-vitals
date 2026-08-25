import { describe, it, expect } from 'vitest';
import { a11yNoDuplicateDt } from '../src/rules/a11y/no-duplicate-dt.js';
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
  const results = await a11yNoDuplicateDt.check(ctx([comp('src/routes/+page.svelte', src)]));
  return results.filter((r) => r.detection.presence === 'none');
};

describe('a11y/no-duplicate-dt', () => {
  it('flags the second occurrence of a name, at its own line, at info severity', async () => {
    const failing = await check('<dl>\n<dt>Coffee</dt>\n<dd>Hot</dd>\n<dt>Coffee</dt>\n<dd>Iced</dd>\n</dl>');
    expect(failing).toHaveLength(1);
    expect(failing[0]!.severity).toBe('info');
    expect(failing[0]!.line).toBe(4);
    expect(failing[0]!.message).toBe('Duplicate <dt> "Coffee" in the same <dl>');
  });

  it('flags a duplicate inside the div-wrapped name-value-group form', async () => {
    const src = '<dl><div><dt>Tea</dt><dd>a</dd></div><div><dt>Tea</dt><dd>b</dd></div></dl>';
    expect(await check(src)).toHaveLength(1);
  });

  it('reports two findings for three same names — every occurrence after the first', async () => {
    const src = '<dl><dt>X</dt><dd>1</dd><dt>X</dt><dd>2</dd><dt>X</dt><dd>3</dd></dl>';
    expect(await check(src)).toHaveLength(2);
  });

  it('scopes names per <dl> — the same name in two lists is fine', async () => {
    const src = '<dl><dt>Y</dt><dd>1</dd></dl>\n<dl><dt>Y</dt><dd>2</dd></dl>';
    expect(await check(src)).toEqual([]);
  });

  it('gives a nested <dl> its own scope — the inner duplicate is reported without leaking outward', async () => {
    // The outer dt shares the inner name on purpose: a scope-leaking walk would count it and
    // report two findings, so exactly one distinguishes per-<dl> scoping from a shared set.
    const src = '<dl><dt>In</dt><dd><dl><dt>In</dt><dd>1</dd><dt>In</dt><dd>2</dd></dl></dd></dl>';
    const failing = await check(src);
    expect(failing).toHaveLength(1);
    expect(failing[0]!.message).toBe('Duplicate <dt> "In" in the same <dl>');
  });

  it('exempts a dt under a logic block — its multiplicity is unknowable', async () => {
    const src = '<dl><dt>Z</dt><dd>1</dd>{#if extra}<dt>Z</dt><dd>2</dd>{/if}</dl>';
    expect(await check(src)).toEqual([]);
  });

  it('reads the name through static phrasing markup and ignores comments', async () => {
    // <code>-wrapped terms are the same text content, and a comment contributes nothing.
    const src = '<dl><dt><code>HTTP</code></dt><dd>1</dd><dt>HT<!-- x -->TP</dt><dd>2</dd></dl>';
    const failing = await check(src);
    expect(failing).toHaveLength(1);
    expect(failing[0]!.message).toBe('Duplicate <dt> "HTTP" in the same <dl>');
  });

  it('exempts a dt with any dynamic content — expression, component, or custom-element child', async () => {
    const src = [
      '<script>import Term from "./Term.svelte";</script>',
      '<dl><dt>{term}</dt><dd>1</dd><dt>{term}</dt><dd>2</dd>',
      '<dt><Term /></dt><dd>3</dd><dt><Term /></dt><dd>4</dd>',
      '<dt><x-term>A</x-term></dt><dd>5</dd><dt><x-term>A</x-term></dt><dd>6</dd></dl>'
    ].join('\n');
    expect(await check(src)).toEqual([]);
  });

  it('compares whitespace-collapsed names, case-sensitively', async () => {
    expect(await check('<dl><dt>A  B</dt><dd>1</dd><dt>A B</dt><dd>2</dd></dl>')).toHaveLength(1);
    expect(await check('<dl><dt>abc</dt><dd>1</dd><dt>ABC</dt><dd>2</dd></dl>')).toEqual([]);
  });

  it('does not treat empty names as duplicates — two blank dts are a different defect', async () => {
    expect(await check('<dl><dt></dt><dd>1</dd><dt></dt><dd>2</dd><dt> </dt><dd>3</dd></dl>')).toEqual([]);
  });

  it('skips a <dl> inside <svg> — it never renders as an HTML description list', async () => {
    const src = '<svg><dl><dt>S</dt><dd>1</dd><dt>S</dt><dd>2</dd></dl></svg>';
    expect(await check(src)).toEqual([]);
  });

  it('is silenced by an inline directive above the duplicated dt', async () => {
    const src =
      '<dl>\n<dt>Coffee</dt>\n<dd>Hot</dd>\n<!-- svelte-vitals-disable-next-line a11y/no-duplicate-dt -->\n<dt>Coffee</dt>\n<dd>Iced</dd>\n</dl>';
    expect(await check(src)).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'a11y/no-duplicate-dt')).toBe(true);
    expect(explainRule('a11y/no-duplicate-dt')?.severity).toBe('info');
  });
});
