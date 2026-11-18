import { describe, it, expect } from 'vitest';
import { effectiveSeverity, hasFailureAtOrAbove } from '../src/summary.js';
import { isPenalized } from '../src/rule.js';
import { findAttr, textFromNodes } from '../src/svelte-ast.js';
import { parse } from 'svelte/compiler';
import { collectComponentFacts, emptyComponentFacts, skippedFileWarnings } from '../src/component.js';
import { propOf, resolveConfigObject } from '../src/config-object.js';
import { parseModuleProgram } from '../src/module-ast.js';
import { documentOrder, exclusiveHeadings } from '../src/headings.js';
import { hasRel } from '../src/head.js';
import { isSvgSrc } from '../src/images.js';
import { defaultConfig, type Result } from '../src/types.js';
import type { Runtime } from '../src/runtime.js';

describe('severity thresholds', () => {
  const summary = { critical: 0, warning: 2, info: 1, passed: 0, dynamic: 0 };
  it('fails at or above a threshold only when a counted severity is there', () => {
    expect(['info', 'warning', 'critical'].map((min) => hasFailureAtOrAbove(summary, min as never))).toEqual([
      true,
      true,
      false
    ]);
    expect(hasFailureAtOrAbove({ ...summary, warning: 0 }, 'warning')).toBe(false);
    expect(hasFailureAtOrAbove({ ...summary, warning: 0 }, 'info')).toBe(true);
  });

  it('downgrades only a dynamic finding to a warning under treatDynamicAs warn', () => {
    const r = (value: 'static' | 'dynamic'): Result =>
      ({ id: 'x/y', severity: 'critical', detection: { presence: 'own', value }, message: '' }) as Result;
    const warn = { ...defaultConfig, treatDynamicAs: 'warn' as const };
    expect([effectiveSeverity(r('static'), warn), effectiveSeverity(r('dynamic'), warn)]).toEqual([
      'critical',
      'warning'
    ]);
  });

  it('penalizes a missing tag or an empty one, and a dynamic one unless dynamic passes', () => {
    const cases = [
      [{ presence: 'none', value: 'absent' }, 'warn'],
      [{ presence: 'own', value: 'absent' }, 'warn'],
      [{ presence: 'own', value: 'static' }, 'warn'],
      [{ presence: 'own', value: 'dynamic' }, 'warn'],
      [{ presence: 'own', value: 'dynamic' }, 'pass']
    ] as const;
    expect(cases.map(([d, t]) => isPenalized(d as never, t as never))).toEqual([true, true, false, true, false]);
  });
});

describe('template text', () => {
  it('joins the text around a comment without a separator', () => {
    const nodes = [
      { type: 'Text', data: 'a' },
      { type: 'Comment', data: 'x' },
      { type: 'Text', data: 'b' }
    ];
    expect(textFromNodes(nodes as never)).toBe('ab');
  });
});

describe('attribute lookup', () => {
  it('skips a directive that shares the attribute name', () => {
    const input = parse('<input bind:value={x} />', { modern: true }).fragment.nodes[0] as never as {
      attributes: never[];
    };
    expect(findAttr(input.attributes, 'value')).toBeUndefined();
  });
});

describe('skipped-file reporting', () => {
  it('lists unparsed files sorted and deduplicated, ten inline at most', () => {
    const files = ['k', 'j', 'i', 'h', 'g', 'f', 'e', 'd', 'c', 'b', 'a', 'a'].map((file) => ({
      file: `${file}.svelte`,
      parseFailed: true as const
    }));
    expect(skippedFileWarnings(files)).toEqual([
      'skipped 11 file(s) that could not be parsed: a.svelte, b.svelte, c.svelte, d.svelte, e.svelte, f.svelte, g.svelte, h.svelte, i.svelte, j.svelte, … and 1 more',
      'findings for these files are unavailable until they parse.'
    ]);
    expect(skippedFileWarnings(files.slice(1))[0]).toBe(
      'skipped 10 file(s) that could not be parsed: a.svelte, b.svelte, c.svelte, d.svelte, e.svelte, f.svelte, g.svelte, h.svelte, i.svelte, j.svelte'
    );
  });

  it('reports a component that does not parse with empty facts', async () => {
    const rt = {
      glob: async () => ['src/lib/Broken.svelte'],
      readFile: async () => '<div>{</div>',
      exists: async () => true,
      join: (...p: string[]) => p.filter(Boolean).join('/')
    } as unknown as Runtime;
    const facts = await collectComponentFacts(rt, '');
    expect(facts).toEqual([{ ...emptyComponentFacts('src/lib/Broken.svelte'), parseFailed: true }]);
    expect(facts[0]!.imports).toEqual([]);
  });
});

describe('config objects', () => {
  const objectOf = (src: string) => {
    const program = parseModuleProgram(`const o = ${src};`, 'x.js').program!;
    return program.body[0].declarations[0].init;
  };
  it('finds a property by identifier or string key, and none behind a computed key', () => {
    expect(propOf(objectOf('{ [kit]: 1 }'), 'kit')).toBeUndefined();
    expect(propOf(objectOf("{ 'other': 1 }"), 'kit')).toBeUndefined();
    expect(propOf(objectOf("{ 'kit': 1 }"), 'kit')?.value).toMatchObject({ value: 1 });
  });
  it('takes a CommonJS module.exports assignment, and no other', () => {
    const cfg = (src: string) => resolveConfigObject(parseModuleProgram(src, 'svelte.config.js').program!);
    expect(cfg('module.exports = { kit: {} };')).toBeDefined();
    expect(cfg('x = { kit: {} };')).toBeUndefined();
    expect(cfg('foo.exports = { kit: {} };')).toBeUndefined();
    expect(cfg('module.other = { kit: {} };')).toBeUndefined();
    expect(cfg('module.exports ||= { kit: {} };')).toBeUndefined();
  });
  it('resolves an exported name through four bindings, and no more', () => {
    const cfg = (src: string) => resolveConfigObject(parseModuleProgram(src, 'svelte.config.js').program!);
    const chain = (n: number) =>
      [
        'const a0 = { kit: {} };',
        ...Array.from({ length: n }, (_, i) => `const a${i + 1} = a${i};`),
        `export default a${n};`
      ].join('\n');
    expect([cfg(chain(3)), cfg(chain(4))].map(Boolean)).toEqual([true, false]);
  });
});

describe('heading order and exclusivity', () => {
  it('orders element by element with a prefix first', () => {
    const h = (order: number[]) => ({ level: 2, order }) as never;
    expect(Math.sign(documentOrder(h([1]), h([1, 2])))).toBe(-1);
    expect(Math.sign(documentOrder(h([1, 2]), h([1, 3])))).toBe(-1);
    expect(Math.sign(documentOrder(h([2]), h([1, 9])))).toBe(1);
  });
  it('takes headings in different arms of one block as exclusive', () => {
    const h = (path: { group: number; branch: number }[]) => ({ level: 2, path }) as never;
    expect(
      exclusiveHeadings(
        h([
          { group: 0, branch: 0 },
          { group: 1, branch: 0 }
        ]),
        h([
          { group: 0, branch: 1 },
          { group: 1, branch: 0 }
        ])
      )
    ).toBe(true);
  });
});

describe('link and image helpers', () => {
  it('reads no rel as holding no token', () => {
    expect(hasRel({}, 'preconnect')).toBe(false);
  });
  it('reads a data: SVG only at the start of the source', () => {
    expect(isSvgSrc('https://x/?u=data:image/svg+xml,abc')).toBe(false);
    expect(isSvgSrc('data:image/svg+xml;base64,abc')).toBe(true);
  });
});
