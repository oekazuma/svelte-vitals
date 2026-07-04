import { describe, it, expect } from 'vitest';
import {
  parseComponentFacts,
  correct002EffectDerived,
  sec001Html,
  defineConfig,
  defaultProject
} from '@svelte-vitals/core';
import type { RuleContext, ComponentFacts } from '@svelte-vitals/core';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: { detection: { presence: string; value: string } }[]) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

const comp = (over: Partial<ComponentFacts>): ComponentFacts => ({
  file: 'src/lib/C.svelte',
  eachBlocks: [],
  effects: [],
  htmlTags: [],
  javascriptUrls: [],
  loc: 10,
  propCount: 0,
  imports: [],
  namespaceImports: [],
  constableStates: [],
  suppressions: [],
  ...over
});

describe('inline suppression directive — end-to-end (issue #92)', () => {
  it('CORRECT002 passes for the real mount-signal $effect source, suppressed via inline directive', async () => {
    const src = [
      '<script>',
      '  let mounted = $state(false);',
      '  // svelte-vitals-disable-next-line CORRECT002',
      '  $effect(() => {',
      '    mounted = true;',
      '  });',
      '  const showVibrationToggle = $derived(mounted && canVibrate());',
      '</script>'
    ].join('\n');
    const facts = parseComponentFacts(src, 'src/lib/C.svelte');
    const ctx: RuleContext = {
      components: [comp({ effects: facts.effects, suppressions: facts.suppressions })],
      ...base
    };
    const rs = await correct002EffectDerived.check(ctx);
    expect(fails(rs)).toHaveLength(0);
  });

  it('SEC001 passes for a real template-side {@html} suppressed via an HTML-comment directive', async () => {
    const src = ['<!-- svelte-vitals-disable-next-line SEC001 -->', '<div>{@html trustedMarkup}</div>'].join('\n');
    const facts = parseComponentFacts(src, 'src/lib/C.svelte');
    const ctx: RuleContext = {
      components: [comp({ htmlTags: facts.htmlTags, suppressions: facts.suppressions })],
      ...base
    };
    const rs = await sec001Html.check(ctx);
    expect(fails(rs)).toHaveLength(0);
  });

  it('does not suppress when a blank line separates the directive from the $effect (documented constraint)', async () => {
    const src = [
      '<script>',
      '  let mounted = $state(false);',
      '  // svelte-vitals-disable-next-line CORRECT002',
      '',
      '  $effect(() => {',
      '    mounted = true;',
      '  });',
      '</script>'
    ].join('\n');
    const facts = parseComponentFacts(src, 'src/lib/C.svelte');
    const ctx: RuleContext = { components: [{ file: 'src/lib/C.svelte', ...facts }], ...base };
    const rs = await correct002EffectDerived.check(ctx);
    expect(fails(rs)).toHaveLength(1);
  });
});
