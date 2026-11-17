import { describe, it, expect } from 'vitest';
import { collectDerivedGuardBindings, collectProgramBindings, parseModuleProgram } from '../src/module-ast.js';
import { parseKitModuleFacts } from '../src/kit-module-parse.js';

const program = (src: string) => parseModuleProgram(src, 'src/lib/x.ts').program;

describe('collectProgramBindings', () => {
  it('binds imports, declarations and a legacy $: assignment, and nothing else at the top level', () => {
    const src = [
      "import def, { named } from 'm';",
      "import * as ns from 'n';",
      '$: legacy = 1;',
      '$: compound += 1;',
      '$: {',
      '  blockAssigned = 1;',
      '}',
      'foo: labelled = 1;',
      'let a,',
      '  { b, c: [d] } = obj;',
      'export const e = 1;',
      'function f() {}',
      'class G {}',
      'export function h() {}',
      'export default function () {}',
      'x = 1;'
    ].join('\n');
    expect([...collectProgramBindings(program(src))].sort()).toEqual([
      'G',
      'a',
      'b',
      'd',
      'def',
      'e',
      'f',
      'h',
      'legacy',
      'named',
      'ns'
    ]);
  });
});

describe('collectDerivedGuardBindings', () => {
  it('takes a top-level const or let whose value is a browser guard', () => {
    const src = [
      'const canUse = browser && x;',
      'let canLet = browser;',
      'var canVar = browser;',
      'export const exported = browser;',
      'const notGuard = 1;',
      'const { destructured } = browser;',
      'let noInit;',
      'const either = browser || other;',
      "const both = browser || typeof window !== 'undefined';",
      "const objectEq = typeof window == 'object';",
      "const looseNe = typeof window != 'undefined';",
      "const fnEq = typeof matchMedia === 'function';",
      "const fnNe = typeof matchMedia !== 'function';",
      "const untracked = typeof notAGlobal === 'undefined';",
      'const dynamicKind = typeof window === kind;'
    ].join('\n');
    expect([...collectDerivedGuardBindings(program(src), new Set(['browser']))].sort()).toEqual([
      'both',
      'canLet',
      'canUse',
      'exported',
      'fnEq',
      'looseNe',
      'objectEq'
    ]);
  });
});

describe('browser-global scan — early-return guards', () => {
  it('stops after a browser guard whose branch ends in return or throw, and only then', () => {
    const src = [
      "import { browser } from '$app/environment';",
      'export function GET() {',
      '  if (!browser) return;',
      '  window.a;',
      '}',
      'export function POST() {',
      '  if (!browser) throw new Error();',
      '  window.b;',
      '}',
      'export function PUT() {',
      '  if (!browser) {',
      "    console.log('server');",
      '    return;',
      '  }',
      '  window.c;',
      '}',
      'export function HEAD() {',
      '  if (!browser) {',
      "    console.log('server');",
      '    throw new Error();',
      '  }',
      '  window.h;',
      '}',
      'export function PATCH() {',
      '  if (!browser) {',
      "    console.log('server');",
      '  }',
      '  document.d;',
      '}',
      'export function DELETE() {',
      '  if (!browser) {}',
      '  document.e;',
      '}',
      'export function OPTIONS() {',
      "  if (!browser) console.log('server');",
      '  document.f;',
      '}'
    ].join('\n');
    expect(parseKitModuleFacts(src, 'src/routes/api/+server.ts').browserGlobalRefs).toEqual([
      { name: 'document', line: 28, inHandler: true },
      { name: 'document', line: 32, inHandler: true },
      { name: 'document', line: 36, inHandler: true }
    ]);
  });
});

describe('browser-global scan — typeof G === undefined || …', () => {
  it('treats only G as safe on the right, and every DOM-only global when G is DOM-only', () => {
    const src = [
      'export function GET() {',
      "  const a = typeof localStorage === 'undefined' || localStorage.getItem('k');",
      "  const b = typeof localStorage === 'undefined' || document.title;",
      "  const c = typeof window === 'undefined' || document.title;",
      "  const d = typeof window == 'undefined' || document.cookie;",
      "  const e = typeof window !== 'undefined' || document.body;",
      "  const f = 'undefined' === typeof window || document.head;",
      "  const g = typeof window === 'object' || document.links;",
      "  const h = typeof window.x === 'undefined' || document.forms;",
      "  const i = typeof notTracked === 'undefined' || document.images;",
      '}'
    ].join('\n');
    expect(parseKitModuleFacts(src, 'src/routes/api/+server.ts').browserGlobalRefs).toEqual([
      { name: 'document', line: 3, inHandler: true },
      { name: 'document', line: 6, inHandler: true },
      { name: 'document', line: 8, inHandler: true },
      { name: 'window', line: 9, inHandler: true },
      { name: 'document', line: 9, inHandler: true },
      { name: 'document', line: 10, inHandler: true }
    ]);
  });
});
