import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const mutated = (script: string, lang = '') =>
  parseComponentFacts(`<script${lang}>\n${script}\n</script>`, 'src/lib/C.svelte').mutatedProps.map((m) => m.name);

describe('prop mutations', () => {
  it('flags mutating calls on a prop, and not its reads, a bare update or an async client call', () => {
    const script = [
      'let { items, count, value, other, dated, keyed, pending, list, obj } = $props();',
      'const n = items.length + 1;',
      'const empty = !items.length;',
      'const doubled = items.map((x) => x * 2);',
      'count++;',
      'other = value.set({ hour: 15 });',
      'dated = dated.set({ hour: 15 }, extra);',
      'keyed = keyed.set(key);',
      'pending.clear().catch(() => {});',
      'list.clear().finally(() => {});',
      'function f() {',
      '  return obj.clear();',
      '}'
    ].join('\n');
    expect(mutated(script)).toEqual(['value', 'dated', 'keyed', 'obj']);
  });

  it('keeps a typed client call its own API unless the result goes back into that prop', () => {
    const script = [
      'interface Client {',
      '  clear(): Client;',
      '}',
      'let { client, spare }: { client: Client; spare: Client } = $props();',
      'let result;',
      'result = client.clear();',
      'spare = other;',
      'client.clear();'
    ].join('\n');
    expect(mutated(script, ' lang="ts"')).toEqual([]);
  });

  it('exempts a legacy mutation only where the same function or $: statement reassigns the prop', () => {
    const script = [
      'export let items;',
      'export let other;',
      'outer: for (const x of xs) {',
      '  items.push(x);',
      '  items = items;',
      '}',
      'function f() {',
      '  other.push(1);',
      '  if (other == null) return;',
      '}'
    ].join('\n');
    expect(mutated(script)).toEqual(['items', 'other']);
  });
});
