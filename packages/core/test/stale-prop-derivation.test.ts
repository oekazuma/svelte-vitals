import { describe, it, expect } from 'vitest';
import { correctnessStalePropDerivation } from '../src/rules/correctness/stale-prop-derivation.js';
import { emptyComponentFacts } from '../src/component.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, stalePropDerivations: ComponentFacts['stalePropDerivations']): ComponentFacts {
  return { ...emptyComponentFacts(file), stalePropDerivations };
}

describe('correctness/stale-prop-derivation', () => {
  it('flags each stale binding with the interpolated message', async () => {
    const results = await correctnessStalePropDerivation.check(
      ctx([comp('src/lib/Badge.svelte', [{ name: 'color', line: 3 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/lib/Badge.svelte');
    expect(penalized[0]!.line).toBe(3);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toContain('"color" is computed from a prop once');
    expect(penalized[0]!.message).toContain('Wrap it in $derived.');
    expect(penalized[0]!.fix?.description).toBeTruthy();
  });

  it('recommends $: (not $derived) for a legacy-mode (export let) prop', async () => {
    const results = await correctnessStalePropDerivation.check(
      ctx([comp('src/lib/Badge.svelte', [{ name: 'color', line: 3, legacy: true }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.message).toContain('Prefix the assignment with $: to make it a reactive statement.');
  });

  it('emits nothing without the fact', async () => {
    expect(await correctnessStalePropDerivation.check(ctx([comp('src/lib/Ok.svelte', [])]))).toEqual([]);
  });
});
