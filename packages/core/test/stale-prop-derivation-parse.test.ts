import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const spd = (src: string) => parseComponentFacts(src, 'A.svelte').stalePropDerivations;

const script = (body: string, template = '{color}') => `<script>\n${body}\n</script>\n${template}`;

describe('stalePropDerivations — flags', () => {
  it("flags the official don't example", () => {
    const src = script(
      `let { type } = $props();\nlet color = type === 'danger' ? 'red' : 'green';`,
      '<p class={color}>x</p>'
    );
    expect(spd(src)).toEqual([{ name: 'color', line: 3 }]);
  });

  it('flags a bare alias and a renamed prop', () => {
    const alias = script(`let { type } = $props();\nconst color = type;`);
    expect(spd(alias)).toEqual([{ name: 'color', line: 3 }]);
    const renamed = script(`let { type: kind } = $props();\nconst color = kind + '-x';`);
    expect(spd(renamed)).toEqual([{ name: 'color', line: 3 }]);
  });

  it('flags derivation from a $bindable prop and from rest props', () => {
    const bindable = script(`let { value = $bindable(0) } = $props();\nconst color = value * 2;`);
    expect(spd(bindable)).toEqual([{ name: 'color', line: 3 }]);
    const rest = script(`let { a, ...rest } = $props();\nconst color = rest.tone;`);
    expect(spd(rest)).toEqual([{ name: 'color', line: 3 }]);
  });

  it('flags an eager object literal but not getters or closures', () => {
    const eager = script(`let { type } = $props();\nconst color = { c: type };`, '{color.c}');
    expect(spd(eager)).toEqual([{ name: 'color', line: 3 }]);
    const getter = script(`let { type } = $props();\nconst color = { get c() { return type; } };`, '{color.c}');
    expect(spd(getter)).toEqual([]);
    const closure = script(`let { type } = $props();\nconst color = () => type;`, '{color()}');
    expect(spd(closure)).toEqual([]);
  });

  it('counts template usage via block expressions and snippet bodies', () => {
    const block = script(`let { n } = $props();\nconst items = [n, n];`, '{#each items as it (it)}<b>{it}</b>{/each}');
    expect(spd(block)).toEqual([{ name: 'items', line: 3 }]);
    const snippet = script(
      `let { type } = $props();\nconst color = type;`,
      '{#snippet s()}<i>{color}</i>{/snippet}{@render s()}'
    );
    expect(spd(snippet)).toEqual([{ name: 'color', line: 3 }]);
  });
});

describe('stalePropDerivations — exclusions', () => {
  it('does not flag $derived, $state capture, calls, new, or await', () => {
    for (const init of [
      `$derived(type + 'x')`,
      `$state(type)`,
      `buildConfig(type)`,
      `new Thing(type)`,
      `type.toUpperCase()`
    ]) {
      const src = script(`let { type } = $props();\nconst color = ${init};`);
      expect(spd(src), init).toEqual([]);
    }
  });

  it('does not flag reassigned or escaped bindings', () => {
    const reassigned = script(`let { type } = $props();\nlet color = type;\ncolor = 'x';`);
    expect(spd(reassigned)).toEqual([]);
    const escaped = script(`let { type } = $props();\nconst color = type;\nregister(color);`);
    expect(spd(escaped)).toEqual([]);
    const bound = script(`let { type } = $props();\nlet color = type;`, '<input bind:value={color} />');
    expect(spd(bound)).toEqual([]);
  });

  it('does not count handler-only or shadowed template usage', () => {
    const handlerOnly = script(
      `let { type } = $props();\nconst color = type;`,
      '<button onclick={() => alert(color)}>x</button>'
    );
    expect(spd(handlerOnly)).toEqual([]);
    const eachShadow = script(
      `let { type } = $props();\nconst color = type;`,
      '{#each list as color (color.id)}<i>{color}</i>{/each}'
    );
    expect(spd(eachShadow)).toEqual([]);
    const snippetShadow = script(
      `let { type } = $props();\nconst color = type;`,
      '{#snippet s(color)}<i>{color}</i>{/snippet}{@render s(1)}'
    );
    expect(spd(snippetShadow)).toEqual([]);
  });

  it('does not flag when props are unknowable, in module scripts, or without props', () => {
    const nested = script(`let { a: { b } } = $props();\nconst color = b;`);
    expect(spd(nested)).toEqual([]);
    const moduleScript = `<script module>\nconst color = 'x';\n</script>\n<script>\nlet { type } = $props();\n</script>\n{color}`;
    expect(spd(moduleScript)).toEqual([]);
    const noProps = script(`const color = 'red';`);
    expect(spd(noProps)).toEqual([]);
    expect(parseComponentFacts('export const x = 1;', 'a.svelte.ts').stalePropDerivations).toEqual([]);
  });
});
