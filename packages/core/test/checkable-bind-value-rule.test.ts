import { describe, it, expect } from 'vitest';
import { correctnessCheckableBindValue } from '../src/rules/correctness/checkable-bind-value.js';
import { emptyComponentFacts } from '../src/component.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, checkableBindValues: ComponentFacts['checkableBindValues']): ComponentFacts {
  return { ...emptyComponentFacts(file), checkableBindValues };
}

describe('correctness/checkable-bind-value', () => {
  it('flags a checkbox with the checkbox-specific message at warning severity', async () => {
    const results = await correctnessCheckableBindValue.check(
      ctx([comp('src/lib/Form.svelte', [{ kind: 'checkbox', line: 4 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/lib/Form.svelte');
    expect(penalized[0]!.line).toBe(4);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toBe(
      'bind:value on a checkbox does not track its checked state — it throws bind_invalid_checkbox_value in development; in a production build it silently tracks the value attribute instead of checkedness. Use bind:checked (single checkbox) or bind:group (checkbox list) instead.'
    );
    expect(penalized[0]!.fix?.description).toContain('bind:checked');
  });

  it('flags a radio with the radio-specific message', async () => {
    const results = await correctnessCheckableBindValue.check(
      ctx([comp('src/lib/Form.svelte', [{ kind: 'radio', line: 6 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.line).toBe(6);
    expect(penalized[0]!.message).toBe(
      'bind:value on a radio input does not track which option is selected — the bound value silently never updates when the user picks one. Use bind:group with a shared group variable across the radio inputs instead.'
    );
  });

  it('flags each fact independently when a file has both', async () => {
    const results = await correctnessCheckableBindValue.check(
      ctx([
        comp('src/lib/Form.svelte', [
          { kind: 'checkbox', line: 4 },
          { kind: 'radio', line: 6 }
        ])
      ])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(2);
  });

  it('emits nothing without the fact', async () => {
    expect(await correctnessCheckableBindValue.check(ctx([comp('src/lib/Ok.svelte', [])]))).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/checkable-bind-value')).toBe(true);
    expect(explainRule('correctness/checkable-bind-value')?.severity).toBe('warning');
  });
});
