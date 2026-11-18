import { describe, it, expect } from 'vitest';
import { parse } from 'svelte/compiler';
import {
  collectComponentConstantLists,
  collectConstantListExports,
  parseComponentFacts
} from '../src/component-parse.js';
import { parseModuleProgram } from '../src/module-ast.js';

const lists = (src: string, opts: { sets?: boolean } = {}) =>
  [...collectComponentConstantLists(parse(src, { modern: true }), opts)].sort();

describe('collectComponentConstantLists', () => {
  it('keeps a const list every use of which only reads it', () => {
    const src = [
      '<script lang="ts">',
      "  import { NAMES } from './n';",
      "  const reads = ['a', 'b'];",
      '  const [first, second] = [1, 2];',
      '  const firstType = typeof reads[0];',
      '  const eached = [1, 2];',
      '  const looped = [1];',
      '  const copied = [1];',
      '  const typed = [1];',
      '  const keyed = [1];',
      "  const asserted = ['x'];",
      '  const nested = [[1]];',
      '  const viaNonMutating = [1];',
      '  for (const x of looped) console.log(x);',
      '  const copy = [...copied];',
      '  const n = reads.length + reads[0];',
      '  const t: typeof typed = [];',
      '  const o = { keyed: 1 };',
      "  const has = (asserted as readonly string[]).includes('x');",
      '  const len = nested[0].length;',
      "  const mapped = viaNonMutating['map']((v) => v);",
      '</script>',
      '{#each eached as e}{e}{/each}',
      '{#each NAMES as n}{n}{/each}'
    ].join('\n');
    expect(lists(src)).toEqual([
      'asserted',
      'copied',
      'eached',
      'keyed',
      'looped',
      'nested',
      'reads',
      't',
      'typed',
      'viaNonMutating'
    ]);
  });

  it('drops a list a use could reorder, and keeps one only a shadowing binding touches', () => {
    const src = [
      '<script lang="ts">',
      '  let notConst = [1];',
      '  const spread = [...other];',
      '  const sorted = [3, 1];',
      '  sorted.sort();',
      '  const byString = [1];',
      "  byString['reverse']();",
      '  const byKey = [1];',
      '  byKey[m]();',
      '  const assigned = [1];',
      '  assigned[0] = 2;',
      '  const updated = [1];',
      '  updated[0]++;',
      '  const castAssigned = [1];',
      '  (castAssigned as number[])[0] = 2;',
      '  const passed = [1];',
      '  use(passed);',
      '  const shorthand = [1];',
      '  const obj = { shorthand };',
      '  const bound = [1];',
      '  const aliased = [1];',
      '  const pick = flag ? aliased : [];',
      "  const keys = ['k'];",
      '  const v = map[keys];',
      '  const handlers = [() => 1];',
      '  handlers[0]();',
      "  const computedKey = ['c'];",
      '  const o2 = { [computedKey]: 1 };',
      '  const param = [1];',
      '  function f(param) {',
      '    param.sort();',
      '  }',
      '</script>',
      '<input bind:value={bound[0]} />'
    ].join('\n');
    expect(lists(src)).toEqual(['param']);
  });

  it('takes new Set([…]) for a list only when asked to', () => {
    const src = [
      '<script>',
      "  const S = new Set(['a', 'b']);",
      "  const T = new Set(['a']);",
      "  T.add('b');",
      "  const M = new Map([['a', 1]]);",
      "  const g = M.get('a');",
      '  const u = S.has(x);',
      '</script>'
    ].join('\n');
    expect(lists(src)).toEqual([]);
    expect(lists(src, { sets: true })).toEqual(['S']);
  });
});

describe('collectConstantListExports', () => {
  it('names the exports used only in the recognised read forms, through const aliases and outside calls', () => {
    const src = [
      "import { custom } from './c';",
      "export const DAYS = ['mon'];",
      "export const TABS = ['a'];",
      "const LOCAL = ['x'];",
      'export { LOCAL as Renamed, LOCAL };',
      'export const SORTED = [2, 1];',
      'SORTED.sort();',
      "export const FED = ['f'];",
      'const schema = z.enum(FED);',
      "export const OWN = ['o'];",
      'function reorder(xs) {',
      '  xs.reverse();',
      '}',
      'reorder(OWN);',
      "export const ALIASED = ['al'];",
      'const days = custom ?? ALIASED;',
      'days.sort();',
      "export const COND = ['c'];",
      'const pick = flag ? COND : [];',
      "export const ANDED = ['and'];",
      'const andAlias = flag && ANDED;',
      "export const NEWED = ['n'];",
      'const s = new Set(NEWED);',
      "export const FALLBACK = ['f'];",
      'const fb = custom ?? FALLBACK;',
      "export const PLAIN = ['p'];",
      'const p = PLAIN;',
      "export const ELSE = ['e'];",
      'const pick2 = flag ? custom : ELSE;',
      "export const LET = ['l'];",
      'let lp = flag ? LET : [];',
      "export const DESTR = ['d'];",
      'const [firstD] = DESTR;',
      "export const VIA = ['v'];",
      'custom(VIA);',
      'function shuffle(xs) {',
      '  xs.sort();',
      '}',
      'export { shuffle };',
      "export const SHUF = ['s'];",
      'shuffle(SHUF);',
      "export const IIFE = ['i'];",
      '((xs) => xs.sort())(IIFE);',
      "export { MONTHS } from './other';",
      "const TYPED = ['t'];",
      'export type { TYPED };',
      'export type T = string;'
    ].join('\n');
    expect([...collectConstantListExports(parseModuleProgram(src, 'src/lib/x.ts').program)].sort()).toEqual([
      'COND',
      'DAYS',
      'ELSE',
      'FALLBACK',
      'FED',
      'LOCAL',
      'NEWED',
      'PLAIN',
      'Renamed',
      'TABS',
      'VIA'
    ]);
  });
});

describe('each blocks over imported lists', () => {
  it('records the import an unkeyed each iterates, by export name or namespace member', () => {
    const src = [
      '<script>',
      "  import { NAMES } from './names';",
      "  import * as ns from './ns';",
      "  import Def from './def';",
      "  import { other as renamed } from './r';",
      "  import * as dyn from './dyn';",
      "  import * as sh from './sh';",
      "  import { local as imported } from './l';",
      '  const local = [1];',
      '  const count = ns.items.length;',
      '  const picked = dyn[key];',
      '  function f(sh) {',
      '    sh.items.sort();',
      '  }',
      '</script>',
      '{#each NAMES as n, i}{n}{/each}',
      '{#each ns.items as i}{i}{/each}',
      '{#each Def as d}{d}{/each}',
      '{#each renamed as x}{x}{/each}',
      '{#each NAMES.items as m}{m}{/each}',
      '{#each dyn.items as d}{d}{/each}',
      '{#each sh.items as s}{s}{/each}',
      '{#each local as l}{l}{/each}',
      '{#each imported as m}{m}{/each}'
    ].join('\n');
    const blocks = (
      parseComponentFacts(src, 'src/lib/C.svelte') as { eachBlocks: { line: number; importedList?: unknown }[] }
    ).eachBlocks;
    expect(blocks.map((b) => [b.line, b.importedList])).toEqual([
      [16, { source: './names', imported: 'NAMES' }],
      [17, { source: './ns', imported: 'items' }],
      [18, undefined],
      [19, { source: './r', imported: 'other' }],
      [20, undefined],
      [21, undefined],
      [22, { source: './sh', imported: 'items' }],
      [24, { source: './l', imported: 'local' }]
    ]);
  });
});
