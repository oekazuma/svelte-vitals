import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/providers/source/parse.js';
import { collectComponentFacts } from '../src/providers/source/components.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

describe('parseComponentFacts — each blocks (CORRECT001)', () => {
  it('detects keyed vs unkeyed {#each}', () => {
    const keyed = parseComponentFacts('{#each items as item (item.id)}<li>{item.name}</li>{/each}', 'C.svelte');
    expect(keyed.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
    const unkeyed = parseComponentFacts('{#each items as item}<li>{item}</li>{/each}', 'C.svelte');
    expect(unkeyed.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
  });
  it('ignores a constant inline array literal (fixed length, never reorders)', () => {
    const c = parseComponentFacts('{#each [1, 2, 3] as n}<li>{n}</li>{/each}', 'C.svelte');
    expect(c.eachBlocks).toEqual([]);
  });
  it('still flags an each over a spread array literal (dynamic length)', () => {
    const c = parseComponentFacts('{#each [...items] as n}<li>{n}</li>{/each}', 'C.svelte');
    expect(c.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
  });
});

describe('parseComponentFacts — $effect (CORRECT002)', () => {
  const facts = (script: string) => parseComponentFacts(`<script>${script}</script>`, 'C.svelte').effects;

  it('flags an $effect whose body only assigns $state', () => {
    const e = facts('let count = $state(0); let double = $state(0); $effect(() => { double = count * 2; });');
    expect(e).toEqual([{ line: 1, assignsOnlyState: true, mountOnly: false }]);
  });
  it('does not flag an $effect that does other work', () => {
    const e = facts('let count = $state(0); $effect(() => { console.log(count); });');
    expect(e).toEqual([{ line: 1, assignsOnlyState: false, mountOnly: false }]);
  });
  it('does not flag assignment to a non-$state variable', () => {
    const e = facts('let count = $state(0); let plain = 0; $effect(() => { plain = count; });');
    expect(e[0]!.assignsOnlyState).toBe(false);
  });
  it('reports no effects when there are none', () => {
    expect(facts('let count = $state(0);')).toEqual([]);
  });
  it('treats $state.raw as a state declaration', () => {
    const e = facts('let big = $state.raw([]); $effect(() => { big = []; });');
    expect(e[0]!.assignsOnlyState).toBe(true);
  });
  it('does not treat $state.snapshot as a state declaration', () => {
    // `snap` is a snapshot read, not reactive state — assigning it is not the derive smell.
    const e = facts('let count = $state(0); let snap = $state.snapshot(count); $effect(() => { snap = count; });');
    expect(e[0]!.assignsOnlyState).toBe(false);
  });
  it('does not flag a compound assignment (accumulation, not derivation)', () => {
    // `+=` reads the previous value, so it can't become a self-referential $derived.
    const e = facts('let total = $state(0); let count = $state(0); $effect(() => { total += count; });');
    expect(e[0]!.assignsOnlyState).toBe(false);
  });
  it('flags an assign-only $effect.pre', () => {
    const e = facts('let count = $state(0); let double = $state(0); $effect.pre(() => { double = count * 2; });');
    expect(e).toEqual([{ line: 1, assignsOnlyState: true, mountOnly: false }]);
  });
  it('ignores non-effect $effect readers ($effect.tracking / $effect.root)', () => {
    const e = facts('let count = $state(0); const t = $effect.tracking(); $effect.root(() => {});');
    expect(e).toEqual([]);
  });
});

describe('parseComponentFacts — security (SEC001/SEC002)', () => {
  it('collects {@html} occurrences', () => {
    const f = parseComponentFacts('<div>{@html body}</div>', 'C.svelte');
    expect(f.htmlTags).toEqual([{ line: 1 }]);
  });
  it('flags a literal javascript: URL in href/src (case-insensitive)', () => {
    expect(parseComponentFacts('<a href="javascript:alert(1)">x</a>', 'C.svelte').javascriptUrls).toEqual([
      { line: 1 }
    ]);
    expect(parseComponentFacts('<iframe src="JavaScript:void(0)"></iframe>', 'C.svelte').javascriptUrls).toEqual([
      { line: 1 }
    ]);
  });
  it('does not flag a normal URL or a dynamic href', () => {
    expect(parseComponentFacts('<a href="https://example.com">x</a>', 'C.svelte').javascriptUrls).toEqual([]);
    expect(parseComponentFacts('<a href={url}>x</a>', 'C.svelte').javascriptUrls).toEqual([]);
  });
  it('flags a javascript: URL on a <svelte:element>', () => {
    const c = parseComponentFacts('<svelte:element this="a" href="javascript:alert(1)">x</svelte:element>', 'C.svelte');
    expect(c.javascriptUrls).toEqual([{ line: 1 }]);
  });
  it('does not flag a mixed value whose rendered URL is not statically known', () => {
    // Leading expression: the real URL is `{base}javascript:..`, not a javascript: URL.
    expect(parseComponentFacts('<a href="{base}javascript:foo">x</a>', 'C.svelte').javascriptUrls).toEqual([]);
    // `javascript:` followed by an expression: still dynamic, so we don't claim it statically.
    expect(parseComponentFacts('<a href="javascript:{evil}">x</a>', 'C.svelte').javascriptUrls).toEqual([]);
  });
  it('reports no security facts for a plain component', () => {
    const f = parseComponentFacts('<p>hi</p>', 'C.svelte');
    expect(f.htmlTags).toEqual([]);
    expect(f.javascriptUrls).toEqual([]);
  });
});

describe('parseComponentFacts — architecture (ARCH001/ARCH002)', () => {
  it('counts source lines (loc), not over-counting a trailing newline', () => {
    expect(parseComponentFacts('<p>a</p>\n<p>b</p>\n<p>c</p>', 'C.svelte').loc).toBe(3);
    expect(parseComponentFacts('<p>a</p>\n<p>b</p>\n<p>c</p>\n', 'C.svelte').loc).toBe(3);
  });
  it('counts destructured props from $props()', () => {
    expect(parseComponentFacts('<script>let { a, b, c } = $props();</script>', 'C.svelte').propCount).toBe(3);
  });
  it('reports 0 props for a rest element or non-destructured $props()', () => {
    expect(parseComponentFacts('<script>let { a, ...rest } = $props();</script>', 'C.svelte').propCount).toBe(0);
    expect(parseComponentFacts('<script>let props = $props();</script>', 'C.svelte').propCount).toBe(0);
  });
  it('returns 0 when any $props() shape is uncountable (mixed patterns)', () => {
    const src = '<script>let { a, b } = $props(); let other = $props();</script>';
    expect(parseComponentFacts(src, 'C.svelte').propCount).toBe(0);
  });
  it('returns 0 when more than one $props() is destructured (ambiguous)', () => {
    const src = '<script>let { a } = $props(); let { b, c } = $props();</script>';
    expect(parseComponentFacts(src, 'C.svelte').propCount).toBe(0);
  });
  it('reports 0 props when there is no $props()', () => {
    expect(parseComponentFacts('<p>hi</p>', 'C.svelte').propCount).toBe(0);
  });
});

describe('parseComponentFacts — imports (PERF009)', () => {
  it('collects import specifiers from the instance script', () => {
    const src = "<script>import _ from 'lodash'; import { onMount } from 'svelte';</script>";
    expect(parseComponentFacts(src, 'C.svelte').imports).toEqual(['lodash', 'svelte']);
  });
  it('collects imports from the module script too', () => {
    const src = "<script module>import x from 'a';</script><script>import y from 'b';</script>";
    expect(parseComponentFacts(src, 'C.svelte').imports.sort()).toEqual(['a', 'b']);
  });
  it('records subpath specifiers verbatim (not normalized)', () => {
    expect(parseComponentFacts("<script>import d from 'lodash/debounce';</script>", 'C.svelte').imports).toEqual([
      'lodash/debounce'
    ]);
  });
  it('reports no imports for a component without a script', () => {
    expect(parseComponentFacts('<p>hi</p>', 'C.svelte').imports).toEqual([]);
  });
});

describe('collectComponentFacts (memory runtime)', () => {
  it('scans every .svelte under src, including $lib', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': '{#each xs as x}<i>{x}</i>{/each}',
      'src/lib/Card.svelte': '<script>let n = $state(0); let d = $state(0); $effect(() => { d = n + 1; });</script>',
      'src/app.html': '<html></html>' // not .svelte → ignored
    });
    const facts = await collectComponentFacts(rt, '');
    const byFile = new Map(facts.map((f) => [f.file, f]));
    expect(byFile.get('src/routes/+page.svelte')!.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
    expect(byFile.get('src/lib/Card.svelte')!.effects[0]!.assignsOnlyState).toBe(true);
    expect(byFile.has('src/app.html')).toBe(false);
  });
});

describe('parseComponentFacts — namespace imports (PERF010)', () => {
  const ns = (script: string) => parseComponentFacts(`<script>${script}</script>`, 'C.svelte').namespaceImports;

  it('captures a bare value namespace import with its source', () => {
    expect(ns("import * as _ from 'lodash';").map((n) => n.source)).toEqual(['lodash']);
  });
  it('captures namespace imports from a module script too', () => {
    const c = parseComponentFacts(
      `<script module>import * as a from 'apkg';</script><script>import * as b from 'bpkg';</script>`,
      'C.svelte'
    );
    expect(c.namespaceImports.map((n) => n.source).sort()).toEqual(['apkg', 'bpkg']);
  });
  it('excludes type-only, named/default, and non-bare namespace imports', () => {
    expect(
      parseComponentFacts(`<script lang="ts">import type * as T from 'tpkg';</script>`, 'C.svelte').namespaceImports
    ).toEqual([]);
    expect(ns("import { debounce } from 'lodash';")).toEqual([]);
    expect(ns("import x from 'xpkg';")).toEqual([]);
    expect(ns("import * as u from './utils';")).toEqual([]);
    expect(ns("import * as e from '$lib/env';")).toEqual([]);
  });
  it('records a 1-based line', () => {
    const [only] = parseComponentFacts(
      `<script>\nimport * as _ from 'lodash';\n</script>`,
      'C.svelte'
    ).namespaceImports;
    expect(only!.line).toBeGreaterThan(0);
  });
});

describe('parseComponentFacts — mount-only $effect (CORRECT003)', () => {
  const facts = (script: string) => parseComponentFacts(`<script>${script}</script>`, 'C.svelte').effects;

  it('marks an effect with only member-call side effects as mountOnly', () => {
    expect(facts('$effect(() => { document.title = "Home"; });')[0]!.mountOnly).toBe(true);
    expect(facts('$effect(() => { el.focus(); });')[0]!.mountOnly).toBe(true);
    expect(facts('$effect(() => analytics.pageView());')[0]!.mountOnly).toBe(true);
  });
  it('is not mountOnly when the body reads reactive state/derived/props', () => {
    expect(facts('let count = $state(0); $effect(() => { console.log(count); });')[0]!.mountOnly).toBe(false);
    expect(facts('let d = $derived(1); $effect(() => { console.log(d); });')[0]!.mountOnly).toBe(false);
    expect(facts('let { title } = $props(); $effect(() => { document.title = title; });')[0]!.mountOnly).toBe(false);
  });
  it('captures reactive names through defaults and nested destructuring (no false positive)', () => {
    // `title` has a default → its binding is an AssignmentPattern, still a reactive prop.
    expect(facts("let { title = 'x' } = $props(); $effect(() => { document.title = title; });")[0]!.mountOnly).toBe(
      false
    );
    // nested destructuring binds `b`.
    expect(facts('let { a: { b } } = $props(); $effect(() => { el.textContent = b; });')[0]!.mountOnly).toBe(false);
  });
  it('is not mountOnly for a store subscription or a bare call', () => {
    expect(facts('$effect(() => { console.log($page); });')[0]!.mountOnly).toBe(false);
    expect(facts('$effect(() => helper());')[0]!.mountOnly).toBe(false);
  });
  it('is not mountOnly for an empty body', () => {
    expect(facts('$effect(() => {});')[0]!.mountOnly).toBe(false);
  });
  it('does not treat a non-computed property name matching a reactive binding as a read', () => {
    // `obj.count` accesses a property named `count`; it does not read the reactive `count`.
    expect(facts('let count = $state(0); $effect(() => { obj.count = 5; });')[0]!.mountOnly).toBe(true);
    // but a computed access `obj[count]` DOES read the reactive index.
    expect(facts('let count = $state(0); $effect(() => { obj[count] = 5; });')[0]!.mountOnly).toBe(false);
  });
  it('covers $effect.pre', () => {
    expect(facts('$effect.pre(() => { el.focus(); });')[0]!.mountOnly).toBe(true);
  });
});

describe('parseComponentFacts — constable $state (CORRECT004)', () => {
  const names = (src: string) => parseComponentFacts(src, 'C.svelte').constableStates.map((s) => s.name);

  it('flags a $state that is only read', () => {
    expect(names('<script>let title = $state("Hi");</script><h1>{title}</h1>')).toEqual(['title']);
    expect(names('<script>let cfg = $state({ a: 1 });</script><p>{cfg.a}</p>')).toEqual(['cfg']);
  });
  it('does not flag a $state written in the script', () => {
    expect(names('<script>let n = $state(0); function inc() { n++; }</script>')).toEqual([]);
    expect(names('<script>let o = $state({}); o.x = 1;</script>')).toEqual([]);
    expect(names('<script>let a = $state([]); a.push(1);</script>')).toEqual([]);
    expect(names('<script>let x = $state(0); use(x);</script>')).toEqual([]);
  });
  it('does not flag a $state mutated in an inline handler', () => {
    expect(names('<script>let n = $state(0);</script><button onclick={() => n++}>+</button>')).toEqual([]);
  });
  it('does not flag a bound $state', () => {
    expect(names('<script>let name = $state("");</script><input bind:value={name} />')).toEqual([]);
  });
  it('does not flag a $state passed as a component prop', () => {
    expect(names('<script>let data = $state({});</script><Child d={data} />')).toEqual([]);
  });
  it('still flags a $state only read in a slot child or DOM attribute', () => {
    expect(names('<script>let label = $state("x");</script><Card>{label}</Card>')).toEqual(['label']);
    expect(names('<script>let ph = $state("x");</script><input value={ph} />')).toEqual(['ph']);
  });
  it('does not flag a $state written via a destructuring assignment', () => {
    expect(names('<script>let count = $state(0); ({ count } = obj);</script>')).toEqual([]);
  });
  it('does not flag a $state property deleted with `delete`', () => {
    expect(names('<script>let m = $state({}); delete m.k;</script>')).toEqual([]);
  });
  it('does not flag a $state passed as a member-expression call argument', () => {
    expect(names('<script>let u = $state({}); save(u.profile);</script>')).toEqual([]);
  });
  it('does not flag a $state mutated via a member update expression', () => {
    expect(names('<script>let s = $state({ n: 0 }); function inc() { s.n++; }</script>')).toEqual([]);
  });
  it('does not flag a $state passed as a spread call argument', () => {
    expect(names('<script>let a = $state([]); send(...a);</script>')).toEqual([]);
    expect(names('<script>let o = $state({}); merge(...o.items);</script>')).toEqual([]);
  });
  it('does not flag a $state passed as a prop to a dynamic component', () => {
    expect(names('<script>let d = $state({});</script><svelte:component this={C} d={d} />')).toEqual([]);
  });
  it('still flags a genuinely read-only $state used in a template expression', () => {
    expect(names('<script>let t = $state("x");</script><p>{t}</p>')).toEqual(['t']);
  });
});
