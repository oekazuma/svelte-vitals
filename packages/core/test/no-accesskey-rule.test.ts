import { describe, it, expect } from 'vitest';
import { a11yNoAccesskey } from '../src/rules/a11y/no-accesskey.js';
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
  const results = await a11yNoAccesskey.check(ctx([comp('src/routes/+page.svelte', src)]));
  return {
    penalized: results.filter((r) => r.detection.presence === 'none'),
    passed: results.filter((r) => r.detection.presence !== 'none')
  };
};

describe('a11y/no-accesskey', () => {
  it('flags a literal accesskey at warning severity', async () => {
    const { penalized } = await check('<button accesskey="s">save</button>');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.line).toBe(1);
    expect(penalized[0]!.message).toBe(
      'accesskey on <button> — the shortcut key varies by browser and OS, is undiscoverable, and conflicts with assistive-technology bindings'
    );
  });

  it('flags an expression-valued accesskey — presence is the problem, the value never matters', async () => {
    const { penalized } = await check('<div accesskey={key}>panel</div>');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.line).toBe(1);
  });

  it('flags each carrier independently', async () => {
    const { penalized } = await check('<a href="/" accesskey="h">home</a>\n<button accesskey="s">save</button>');
    expect(penalized.map((r) => r.line)).toEqual([1, 2]);
  });

  it('stays silent for a spread-only carrier — unknowable', async () => {
    const { penalized, passed } = await check('<button {...rest}>save</button>');
    expect(penalized).toEqual([]);
    expect(passed).toEqual([]);
  });

  it('emits nothing for a component without accesskey', async () => {
    const { penalized, passed } = await check('<button>save</button>');
    expect(penalized).toEqual([]);
    expect(passed).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'a11y/no-accesskey')).toBe(true);
    expect(explainRule('a11y/no-accesskey')?.severity).toBe('warning');
  });
});
