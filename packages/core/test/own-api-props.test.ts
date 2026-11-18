import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const mutated = (script: string) =>
  parseComponentFacts(`<script lang="ts">\n${script}\n</script>`, 'src/lib/C.svelte').mutatedProps.map((m) => m.name);

/** Destructures `names` from `$props()` typed `Props`, then calls `.clear()` on each. */
const clearing = (names: string[]) =>
  [`let { ${names.join(', ')} }: Props = $props();`, ...names.map((n) => `${n.split(' ')[0]}.clear();`)].join('\n');

describe('props with their own API', () => {
  it('takes a method call as the API of a prop only when its declared type cannot be a collection', () => {
    const props = ['client', 'aliased', 'plain', 'callback', 'remote', 'bag', 'items', 'either', 'bytes'];
    const more = ['qualified', 'loose', 'withArgs', 'defaulted = makeClient()'];
    const script = [
      "import type { Remote } from './remote';",
      'interface Client {',
      '  clear(): void;',
      '}',
      'type ClientAlias = Client;',
      'interface Bag extends Set<string> {}',
      'type Items = string[];',
      'interface Props {',
      '  client: Client;',
      '  aliased: ClientAlias;',
      '  plain: string;',
      '  callback: () => void;',
      '  remote: Remote;',
      '  bag: Bag;',
      '  items: Items;',
      '  either: Client | Set<string>;',
      '  bytes: Uint8Array;',
      '  qualified: Api.Client;',
      '  loose;',
      '  withArgs: Readonly<string[]>;',
      '  defaulted: Client;',
      '}',
      clearing([...props, ...more])
    ].join('\n');
    expect(mutated(script)).toEqual(['bag', 'items', 'either', 'bytes', 'qualified', 'loose', 'withArgs']);
  });

  it('follows at most four aliases from a prop to its type, unions included', () => {
    const script = [
      'interface Client {',
      '  clear(): void;',
      '}',
      'type A1 = A2;',
      'type A2 = A3;',
      'type A3 = A4;',
      'type A4 = Client;',
      'type B1 = B2;',
      'type B2 = B3;',
      'type B3 = B4;',
      'type B4 = B5;',
      'type B5 = Client;',
      'type U1 = string | U2;',
      'type U2 = string | U3;',
      'type U3 = string | Client;',
      'interface Props {',
      '  four: A1;',
      '  five: B1;',
      '  unions: U1;',
      '}',
      clearing(['four', 'five', 'unions'])
    ].join('\n');
    expect(mutated(script)).toEqual(['five', 'unions']);
  });

  it('reads the props type through at most five type names, and not from an import', () => {
    const behind = (n: number) => [
      'interface Client {',
      '  clear(): void;',
      '}',
      ...Array.from({ length: n - 1 }, (_, i) => `type P${i} = P${i + 1};`),
      `type P${n - 1} = { client: Client };`,
      clearing(['client']).replace(': Props', ': P0')
    ];
    expect(mutated(behind(5).join('\n'))).toEqual([]);
    expect(mutated(behind(6).join('\n'))).toEqual(['client']);
    expect(mutated(["import type { Props } from './props';", clearing(['client'])].join('\n'))).toEqual(['client']);
  });
});
