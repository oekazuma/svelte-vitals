import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

describe('parseComponentFacts — each blocks (correctness/each-key)', () => {
  const facts = (src: string) => parseComponentFacts(src, 'C.svelte');
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
  it('ignores an itemless each (the "render N times" pattern — no item identity to key on)', () => {
    const c = parseComponentFacts('{#each { length: 8 }, rank}<div>{rank}</div>{/each}', 'C.svelte');
    expect(c.eachBlocks).toEqual([]);
  });
  it('ignores an itemless each even if it is (pointlessly) given an index key', () => {
    const c = parseComponentFacts('{#each { length: 8 }, rank (rank)}<div>{rank}</div>{/each}', 'C.svelte');
    expect(c.eachBlocks).toEqual([]);
  });
  it('flags an each block keyed by its index', () => {
    const c = parseComponentFacts('{#each items as item, i (i)}<li>{item}</li>{/each}', 'C.svelte');
    expect(c.eachBlocks).toEqual([{ hasKey: true, line: 1, indexKey: true }]);
  });
  it('flags a renamed index key', () => {
    const c = parseComponentFacts('{#each items as item, idx (idx)}<li>{item}</li>{/each}', 'C.svelte');
    expect(c.eachBlocks).toEqual([{ hasKey: true, line: 1, indexKey: true }]);
  });
  it('does not set indexKey for item-based keys, other identifiers, or missing index', () => {
    const byId = parseComponentFacts('{#each items as item, i (item.id)}<li>{item}</li>{/each}', 'C.svelte');
    expect(byId.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
    const otherIdent = parseComponentFacts('{#each items as item, i (globalKey)}<li>{item}</li>{/each}', 'C.svelte');
    expect(otherIdent.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
    const noIndex = parseComponentFacts('{#each items as item (item)}<li>{item}</li>{/each}', 'C.svelte');
    expect(noIndex.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
  });
  it('does not set indexKey on composite keys containing the index', () => {
    const c = parseComponentFacts('{#each items as item, i (item.id + "-" + i)}<li>{item}</li>{/each}', 'C.svelte');
    expect(c.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
  });
  it('flags trivial stringifications of the index', () => {
    for (const key of ['String(i)', '`${i}`', 'i.toString()', 'String(i as number)']) {
      const c = parseComponentFacts(
        `<script lang="ts"></script>{#each items as item, i (${key})}<li>{item}</li>{/each}`,
        'C.svelte'
      );
      expect(c.eachBlocks, key).toEqual([{ hasKey: true, line: 1, indexKey: true }]);
    }
  });
  it('does not flag stringifications of non-index values or composite templates', () => {
    for (const key of ['String(item.id)', '`${item.id}`', '`row-${i}`', '`${i}-${item.id}`', 'item.id.toString()']) {
      const c = parseComponentFacts(`{#each items as item, i (${key})}<li>{item}</li>{/each}`, 'C.svelte');
      expect(c.eachBlocks, key).toEqual([{ hasKey: true, line: 1 }]);
    }
  });

  it('skips length-only placeholder lists entirely', () => {
    for (const list of ['Array(n)', 'new Array(8)', '[...Array(n)]', 'Array.from({ length: n })']) {
      const c = facts(`{#each ${list} as _, i (i)}<li>{i}</li>{/each}`);
      expect(c.eachBlocks, list).toEqual([]);
    }
    const unkeyed = facts('{#each [...Array(n)] as _, i}<li>{i}</li>{/each}');
    expect(unkeyed.eachBlocks).toEqual([]);
  });

  it('still collects spread lists with real items', () => {
    const c = facts('{#each [...items] as item, i (i)}<li>{item}</li>{/each}');
    expect(c.eachBlocks).toEqual([{ hasKey: true, line: 1, indexKey: true }]);
  });

  it('flags non-null-asserted and coerced index keys', () => {
    const withTs = (key: string) =>
      facts(`<script lang="ts"></script>{#each items as item, i (${key})}<li>{item}</li>{/each}`);
    expect(withTs('i!').eachBlocks).toEqual([{ hasKey: true, line: 1, indexKey: true }]);
    expect(withTs('String(i)!').eachBlocks).toEqual([{ hasKey: true, line: 1, indexKey: true }]);
    for (const key of ["i + ''", "'' + i", 'Number(i)']) {
      const c = facts(`{#each items as item, i (${key})}<li>{item}</li>{/each}`);
      expect(c.eachBlocks, key).toEqual([{ hasKey: true, line: 1, indexKey: true }]);
    }
  });

  it('does not flag composite concatenations or non-index coercions', () => {
    for (const key of ["i + '-row'", "'row' + i", 'Number(item.id)']) {
      const c = facts(`{#each items as item, i (${key})}<li>{item}</li>{/each}`);
      expect(c.eachBlocks, key).toEqual([{ hasKey: true, line: 1 }]);
    }
  });
});

describe('parseComponentFacts — $effect (correctness/effect-as-derived)', () => {
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

  // The "mount signal" idiom (hydration-mismatch guard, issue #92): a boolean
  // $state flipped to true in an $effect so a $derived reads false during SSR/prerender
  // and the client's first render, then its real value after mount. $derived can't
  // replace this — it evaluates eagerly during hydration, reintroducing the mismatch
  // the $effect exists to avoid. The check is intentionally structural (only-assigns),
  // not semantic, so the bare mount-flag effect is flagged (suppress it inline per the
  // docs) while adding *any* other statement — like mount-time listener setup — already
  // takes it out of "only assigns state" and it stops being flagged, whether or not that
  // extra statement happens to also be mount-only bookkeeping.
  it('flags a bare mount-flag effect (mounted = true) — the known false positive, suppress via inline directive', () => {
    const e = facts('let mounted = $state(false); $effect(() => { mounted = true; });');
    expect(e).toEqual([{ line: 1, assignsOnlyState: true, mountOnly: false }]);
  });
  it('does not flag the same mount-flag assignment once the effect also does other mount-time setup', () => {
    const e = facts(
      `let mounted = $state(false);
       $effect(() => {
         mounted = true;
         const onEvent = (e) => {};
         window.addEventListener('some-event', onEvent);
         return () => window.removeEventListener('some-event', onEvent);
       });`
    );
    expect(e[0]!.assignsOnlyState).toBe(false);
  });
});

describe('parseComponentFacts — security (security/raw-html/security/javascript-url)', () => {
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

describe('parseComponentFacts — architecture (architecture/component-size/architecture/prop-count)', () => {
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

describe('parseComponentFacts — imports (performance/heavy-import)', () => {
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

describe('parseComponentFacts — namespace imports (performance/namespace-import)', () => {
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

describe('parseComponentFacts — mount-only $effect (correctness/effect-as-onmount)', () => {
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

describe('parseComponentFacts — constable $state (correctness/unmutated-state)', () => {
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
  it('still flags a $state when only a shadowing local of the same name is written (issue #140)', () => {
    expect(names('<script>let count = $state(0); function f() { let count = 0; count++; }</script>')).toEqual([
      'count'
    ]);
    expect(names('<script>let count = $state(0); function f(count) { count++; }</script>')).toEqual(['count']);
    expect(names('<script>let items = $state([]);</script>{#each other as items}{items.push(1)}{/each}')).toEqual([
      'items'
    ]);
    expect(names('<script>let i = $state(0); for (let i = 0; i < 3; i++) {}</script>')).toEqual(['i']);
  });
});

describe('parseComponentFacts — mutated non-bindable props (correctness/prop-mutation)', () => {
  const names = (src: string) => parseComponentFacts(src, 'C.svelte').mutatedProps.map((m) => m.name);

  it('flags a member-expression write on a destructured prop', () => {
    expect(names('<script>let { user } = $props(); user.name = "x";</script>')).toEqual(['user']);
    expect(names('<script>let { count } = $props(); count.n += 1;</script>')).toEqual(['count']);
  });
  it('flags a member update expression on a destructured prop', () => {
    expect(names('<script>let { obj } = $props(); function inc() { obj.n++; }</script>')).toEqual(['obj']);
  });
  it('flags `delete` on a destructured prop property', () => {
    expect(names('<script>let { obj } = $props(); delete obj.k;</script>')).toEqual(['obj']);
  });
  it('flags a mutating method call on a destructured prop', () => {
    expect(names('<script>let { items } = $props(); items.push(1);</script>')).toEqual(['items']);
    expect(names('<script>let { items } = $props(); items.splice(0, 1);</script>')).toEqual(['items']);
    expect(names('<script>let { m } = $props(); m.set("k", 1);</script>')).toEqual(['m']);
  });
  it('does not flag plain reassignment of the prop itself (sanctioned ephemeral-state pattern)', () => {
    expect(names('<script>let { count } = $props(); count = 5;</script>')).toEqual([]);
    expect(names('<script>let { count } = $props(); count += 1;</script>')).toEqual([]);
  });
  it('does not flag mutation of a $bindable-declared prop', () => {
    expect(names('<script>let { value = $bindable() } = $props(); value.x = 1;</script>')).toEqual([]);
    expect(names('<script>let { value = $bindable("fallback") } = $props(); value += "!";</script>')).toEqual([]);
  });
  it('flags mutation of a renamed (aliased) destructured prop by its local name', () => {
    expect(names('<script>let { super: trouper } = $props(); trouper.x = 1;</script>')).toEqual(['trouper']);
  });
  it('flags mutation via the rest-props binding (rest can never be individually bindable)', () => {
    expect(names('<script>let { a, ...rest } = $props(); rest.b = 1;</script>')).toEqual(['rest']);
  });
  it('flags mutation when $props() is not destructured at all (no field can be $bindable)', () => {
    expect(names('<script>let props = $props(); props.x = 1;</script>')).toEqual(['props']);
  });
  it('flags a prop mutated in an inline template handler', () => {
    expect(names('<script>let { items } = $props();</script><button onclick={() => items.push(1)}>+</button>')).toEqual(
      ['items']
    );
  });
  it('does not flag mutation of a plain non-prop variable', () => {
    expect(names('<script>let { user } = $props(); let other = {}; other.x = 1;</script>')).toEqual([]);
  });
  it('does not flag anything when there is no $props()', () => {
    expect(names('<script>let x = 1; x = 2;</script>')).toEqual([]);
  });
  it('does not flag a mutation of a same-named function parameter that shadows the prop (review)', () => {
    expect(names('<script>let { items } = $props(); function process(items) { items.push(1); }</script>')).toEqual([]);
  });
  it('still flags the real prop once outside the shadowing function (review)', () => {
    expect(
      names('<script>let { items } = $props(); function process(items) { items.push(1); } items.sort();</script>')
    ).toEqual(['items']);
  });
  it('does not flag a mutation of an {#each} loop variable that shadows the prop (review)', () => {
    expect(names('<script>let { items } = $props();</script>{#each other as items}{items.push(1)}{/each}')).toEqual([]);
  });
  it('does not flag a mutation of a block-scoped let/const that shadows the prop (issue #140)', () => {
    expect(names('<script>let { items } = $props(); if (true) { let items = []; items.push(1); }</script>')).toEqual(
      []
    );
  });
  it('does not flag a mutation of a for-loop variable that shadows the prop (issue #140)', () => {
    expect(
      names('<script>let { items } = $props(); for (let items = []; false; ) { items.push(1); }</script>')
    ).toEqual([]);
  });
  it('does not flag a mutation of a catch-clause parameter that shadows the prop (issue #140)', () => {
    expect(names('<script>let { items } = $props(); try {} catch (items) { items.push(1); }</script>')).toEqual([]);
  });
  it('still flags the real prop mutation alongside an unrelated shadowed block (issue #140)', () => {
    expect(
      names('<script>let { items } = $props(); if (true) { let items = []; items.push(1); } items.sort();</script>')
    ).toEqual(['items']);
  });

  it('flags a mutating method call on a legacy `export let` prop, marked legacy', () => {
    const facts = parseComponentFacts('<script>export let items; items.push(1);</script>', 'C.svelte');
    expect(facts.mutatedProps).toEqual([{ name: 'items', line: 1, legacy: true }]);
  });
  it('flags a member-expression write on a legacy `export let` prop with a default value', () => {
    const facts = parseComponentFacts('<script>export let user = {}; user.name = "x";</script>', 'C.svelte');
    expect(facts.mutatedProps).toEqual([{ name: 'user', line: 1, legacy: true }]);
  });
  it('does not flag plain reassignment of a legacy prop (the sanctioned pattern for re-triggering reactivity)', () => {
    expect(names('<script>export let items; items = items;</script>')).toEqual([]);
  });
});

describe('parseComponentFacts — suppression directives (issue #92)', () => {
  it('captures a script-side disable-next-line with a rule id', () => {
    const src =
      '<script>\n// svelte-vitals-disable-next-line correctness/effect-as-derived\n$effect(() => { x = 1; });\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([
      { line: 3, ruleIds: ['correctness/effect-as-derived'] }
    ]);
  });
  it('captures multiple comma-separated rule ids', () => {
    const src =
      '<script>\n// svelte-vitals-disable-next-line correctness/effect-as-derived, security/raw-html\nx = 1;\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([
      { line: 3, ruleIds: ['correctness/effect-as-derived', 'security/raw-html'] }
    ]);
  });
  it('captures a blanket disable-next-line with no rule id', () => {
    const src = '<script>\n// svelte-vitals-disable-next-line\nx = 1;\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([{ line: 3, ruleIds: undefined }]);
  });
  it('captures a template-side HTML comment directive', () => {
    const src = '<!-- svelte-vitals-disable-next-line security/raw-html -->\n<div>{@html body}</div>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([{ line: 2, ruleIds: ['security/raw-html'] }]);
  });
  it('does not match a same-line trailing comment', () => {
    const src = '<script>\nx = 1; // svelte-vitals-disable-next-line correctness/effect-as-derived\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([]);
  });
  it('reports no suppressions for a component without any directive', () => {
    expect(parseComponentFacts('<p>hi</p>', 'C.svelte').suppressions).toEqual([]);
  });
});

describe('parseComponentFacts — orphan $effect in <script module> (correctness/orphan-effect)', () => {
  const orphans = (src: string) => parseComponentFacts(src, 'C.svelte').orphanEffects;

  it('flags a top-level $effect in <script module>', () => {
    const src = '<script module>\nlet c = $state(0);\n$effect(() => { console.log(c); });\n</script>\n<p>hi</p>';
    expect(orphans(src)).toEqual([{ line: 3, kind: 'top-level' }]);
  });
  it('does not flag $effect in the instance script (component init context)', () => {
    expect(orphans('<script>\n$effect(() => { console.log(1); });\n</script>')).toEqual([]);
  });
  it('flags $effect.pre inside a top-level if block', () => {
    const src = '<script module>\nif (globalThis.browser) {\n  $effect.pre(() => { console.log(1); });\n}\n</script>';
    expect(orphans(src)).toEqual([{ line: 3, kind: 'top-level' }]);
  });
  it('does not flag an effect inside an $effect.root callback', () => {
    const src = '<script module>\n$effect.root(() => {\n  $effect(() => { console.log(1); });\n});\n</script>';
    expect(orphans(src)).toEqual([]);
  });
  it('does not flag an effect inside a function declaration', () => {
    const src = '<script module>\nexport function setup() {\n  $effect(() => { console.log(1); });\n}\n</script>';
    expect(orphans(src)).toEqual([]);
  });
  it('flags a module-scope new of a same-file class with a bare constructor effect', () => {
    const src = [
      '<script module>',
      'class Store {',
      '  v = $state(0);',
      '  constructor() {',
      '    $effect(() => { console.log(this.v); });',
      '  }',
      '}',
      'export const store = new Store();',
      '</script>'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 8, kind: 'constructor-instantiated', className: 'Store' }]);
  });
  it('does not flag the class when it is never instantiated at module scope', () => {
    const src = [
      '<script module>',
      'export class Store {',
      '  constructor() {',
      '    $effect(() => {});',
      '  }',
      '}',
      '</script>'
    ].join('\n');
    expect(orphans(src)).toEqual([]);
  });
  it('does not flag when the constructor effect is wrapped in $effect.root', () => {
    const src = [
      '<script module>',
      'class Store {',
      '  constructor() {',
      '    $effect.root(() => {',
      '      $effect(() => {});',
      '    });',
      '  }',
      '}',
      'export const store = new Store();',
      '</script>'
    ].join('\n');
    expect(orphans(src)).toEqual([]);
  });
});

describe('parseComponentFacts — orphan $effect in runes modules (.svelte.ts/.svelte.js)', () => {
  const orphans = (src: string, file = 'src/lib/store.svelte.ts') => parseComponentFacts(src, file).orphanEffects;

  it('flags a top-level $effect, with line numbers matching the unwrapped source', () => {
    expect(orphans('let c = $state(0);\n$effect(() => { console.log(c); });')).toEqual([
      { line: 2, kind: 'top-level' }
    ]);
  });
  it('flags the shared-state-class pattern: bare constructor effect + module-scope new', () => {
    const src = [
      'class QuizStateManager {',
      '  bookmarks = $state([]);',
      '  constructor() {',
      '    $effect(() => { save(this.bookmarks); });',
      '  }',
      '}',
      'export const quizState = new QuizStateManager();'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 7, kind: 'constructor-instantiated', className: 'QuizStateManager' }]);
  });
  it('does not flag effects inside $effect.root, functions, or non-instantiated classes', () => {
    expect(orphans('$effect.root(() => {\n  $effect(() => {});\n});')).toEqual([]);
    expect(orphans('export function useThing() {\n  $effect(() => {});\n}')).toEqual([]);
    expect(orphans('export class S {\n  constructor() {\n    $effect(() => {});\n  }\n}')).toEqual([]);
  });
  it('does not flag a constructor effect wrapped in $effect.root, even when instantiated', () => {
    const src = [
      'class S {',
      '  constructor() {',
      '    $effect.root(() => {',
      '      $effect(() => {});',
      '    });',
      '  }',
      '}',
      'export const s = new S();'
    ].join('\n');
    expect(orphans(src)).toEqual([]);
  });
  it('parses TS module syntax (type-only imports, satisfies, top-level await)', () => {
    const src = [
      'import type { Foo } from "./types";',
      'const cfg = { a: 1 } satisfies Record<string, number>;',
      'export const x = await Promise.resolve(1);',
      '$effect(() => { console.log(x); });'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 4, kind: 'top-level' }]);
  });
  it('handles .svelte.js too', () => {
    expect(orphans('$effect(() => {});', 'src/lib/store.svelte.js')).toEqual([{ line: 1, kind: 'top-level' }]);
  });
  it('collects suppression directives against unwrapped line numbers', () => {
    const facts = parseComponentFacts(
      '// svelte-vitals-disable-next-line correctness/orphan-effect\n$effect(() => {});',
      'src/lib/s.svelte.ts'
    );
    expect(facts.orphanEffects).toEqual([{ line: 2, kind: 'top-level' }]);
    expect(facts.suppressions).toEqual([{ line: 2, ruleIds: ['correctness/orphan-effect'] }]);
  });
  it('keeps component-only facts empty for a module file', () => {
    const facts = parseComponentFacts('let c = $state(0);\nexport function inc() { c += 1; }', 'src/lib/c.svelte.ts');
    expect(facts.effects).toEqual([]);
    expect(facts.eachBlocks).toEqual([]);
    expect(facts.constableStates).toEqual([]);
    expect(facts.loc).toBe(0);
  });

  it('does not flag a module-scope new of an imported class shadowed by a block-scoped class', () => {
    const src = [
      "import { Store } from './safe.js';",
      'export const s = new Store();',
      '{',
      '  class Store {',
      '    constructor() {',
      '      $effect(() => {});',
      '    }',
      '  }',
      '  register(() => new Store());',
      '}'
    ].join('\n');
    expect(orphans(src)).toEqual([]);
  });
  it('does not register a named class expression under its own (inner-only) name', () => {
    const src = [
      'const A = class Store {',
      '  constructor() {',
      '    $effect(() => {});',
      '  }',
      '};',
      'export const s = new Store();'
    ].join('\n');
    expect(orphans(src)).toEqual([]);
  });
  it('still flags an export-wrapped top-level class and an export-wrapped new', () => {
    const src = [
      'export class Store {',
      '  constructor() {',
      '    $effect(() => {});',
      '  }',
      '}',
      'export const s = new Store();'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 6, kind: 'constructor-instantiated', className: 'Store' }]);
  });
  it('sees through TS constructor overload signatures to the implementation body', () => {
    const src = [
      'class S {',
      '  constructor(a: string);',
      '  constructor(a: number);',
      '  constructor(a: unknown) {',
      '    $effect(() => {});',
      '  }',
      '}',
      'export const s = new S(1);'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 8, kind: 'constructor-instantiated', className: 'S' }]);
  });
  it('still flags a guarded constructor effect (guards are not evaluated statically)', () => {
    const src = [
      'class Store {',
      '  constructor(persist) {',
      '    if (persist) $effect(() => {});',
      '  }',
      '}',
      'export const s = new Store(false);'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 6, kind: 'constructor-instantiated', className: 'Store' }]);
  });
  it('detects effects in a module containing a literal "</script>" string', () => {
    const src = 'const tpl = "</' + 'script>";\n$effect(() => {});';
    expect(orphans(src)).toEqual([{ line: 2, kind: 'top-level' }]);
  });
  it('flags an export-default new of an effectful class', () => {
    const src = [
      'class Store {',
      '  constructor() {',
      '    $effect(() => {});',
      '  }',
      '}',
      'export default new Store();'
    ].join('\n');
    expect(orphans(src)).toEqual([{ line: 6, kind: 'constructor-instantiated', className: 'Store' }]);
  });
});

describe('parseComponentFacts — module-scope $state declarations (security/shared-state-import)', () => {
  const decls = (src: string, file = 'src/lib/store.svelte.ts') => parseComponentFacts(src, file).moduleStateDecls;

  it('collects top-level $state and $state.raw variable declarations', () => {
    const src = 'export const user = $state({ name: "" });\nlet count = $state.raw(0);';
    expect(decls(src)).toEqual([
      { name: 'user', line: 1 },
      { name: 'count', line: 2 }
    ]);
  });
  it('collects a module-scope new of a same-file class with a $state field', () => {
    const src = [
      'class QuizStateManager {',
      '  bookmarks = $state([]);',
      '}',
      'export const quizState = new QuizStateManager();'
    ].join('\n');
    expect(decls(src)).toEqual([{ name: 'quizState', line: 4 }]);
  });
  it('ignores $state inside functions and classes without a module-scope new', () => {
    const src = [
      'export function createStore() {',
      '  const s = $state({});',
      '  return s;',
      '}',
      'class Unused {',
      '  v = $state(0);',
      '}'
    ].join('\n');
    expect(decls(src)).toEqual([]);
  });
  it('stays empty for .svelte components (script module $state is out of scope)', () => {
    const facts = parseComponentFacts('<script module>\nexport const s = $state({});\n</script>', 'C.svelte');
    expect(facts.moduleStateDecls).toEqual([]);
  });
});

describe('parseComponentFacts — orphan lifecycle calls (correctness/orphan-lifecycle)', () => {
  const calls = (src: string, file = 'src/lib/store.svelte.ts') => parseComponentFacts(src, file).orphanLifecycleCalls;

  it('flags top-level lifecycle/context calls imported from svelte', () => {
    const src = "import { onMount, getContext } from 'svelte';\nonMount(() => {});\nconst theme = getContext('theme');";
    expect(calls(src)).toEqual([
      { name: 'onMount', line: 2, kind: 'top-level' },
      { name: 'getContext', line: 3, kind: 'top-level' }
    ]);
  });
  it('flags every tracked callee at top level', () => {
    const names = [
      'onMount',
      'onDestroy',
      'beforeUpdate',
      'afterUpdate',
      'createEventDispatcher',
      'getContext',
      'setContext',
      'hasContext',
      'getAllContexts'
    ];
    for (const name of names) {
      expect(calls(`import { ${name} } from 'svelte';\n${name}();`)).toEqual([{ name, line: 2, kind: 'top-level' }]);
    }
  });
  it('records the canonical name for aliased imports and namespace member calls', () => {
    expect(calls("import { onMount as om } from 'svelte';\nom(() => {});")).toEqual([
      { name: 'onMount', line: 2, kind: 'top-level' }
    ]);
    expect(calls("import * as s from 'svelte';\ns.setContext('k', 1);")).toEqual([
      { name: 'setContext', line: 2, kind: 'top-level' }
    ]);
  });
  it('flags a module-scope new of a class whose constructor calls a tracked function', () => {
    const src = [
      "import { getContext } from 'svelte';",
      'class Store {',
      '  constructor() {',
      "    this.user = getContext('user');",
      '  }',
      '}',
      'export const store = new Store();'
    ].join('\n');
    expect(calls(src)).toEqual([{ name: 'getContext', line: 7, kind: 'constructor-instantiated', className: 'Store' }]);
  });
  it('does not flag calls inside functions, createContext, non-context svelte exports, or other packages', () => {
    expect(calls("import { onMount } from 'svelte';\nexport function setup() {\n  onMount(() => {});\n}")).toEqual([]);
    expect(calls("import { createContext } from 'svelte';\nconst ctx = createContext();")).toEqual([]);
    expect(calls("import { getContext } from './my-di.js';\nconst x = getContext('k');")).toEqual([]);
    expect(calls("import { tick } from 'svelte';\ntick();")).toEqual([]);
  });
  it('flags <script module> calls but not instance-script calls in .svelte files', () => {
    const mod = "<script module>\nimport { setContext } from 'svelte';\nsetContext('k', 1);\n</script>";
    expect(parseComponentFacts(mod, 'C.svelte').orphanLifecycleCalls).toEqual([
      { name: 'setContext', line: 3, kind: 'top-level' }
    ]);
    const inst = "<script>\nimport { onMount } from 'svelte';\nonMount(() => {});\n</script>";
    expect(parseComponentFacts(inst, 'C.svelte').orphanLifecycleCalls).toEqual([]);
  });
  it('keeps orphanEffects unchanged through the generalised collectors', () => {
    const f = parseComponentFacts('$effect(() => {});', 'src/lib/s.svelte.ts');
    expect(f.orphanEffects).toEqual([{ line: 1, kind: 'top-level' }]);
    expect(f.orphanLifecycleCalls).toEqual([]);
  });
  it('does not flag a constructor parameter shadowing an imported lifecycle name', () => {
    const src = [
      "import { setContext } from 'svelte';",
      'class Store {',
      '  constructor(setContext) {',
      "    setContext('k', 1);",
      '  }',
      '}',
      'export const s = new Store((k, v) => {});'
    ].join('\n');
    expect(calls(src)).toEqual([]);
  });
  it('does not flag a top-level block-local shadowing an imported lifecycle name', () => {
    const src = "import { onMount } from 'svelte';\n{\n  const onMount = (f) => f;\n  onMount(() => {});\n}";
    expect(calls(src)).toEqual([]);
  });
  it('does not track computed namespace member calls or type-only specifiers', () => {
    expect(calls("import * as s from 'svelte';\ns['setContext']('k', 1);")).toEqual([]);
    expect(calls("import { type onMount, tick } from 'svelte';\ntick();")).toEqual([]);
  });
});

describe('parseComponentFacts — browser-global refs (correctness/server-browser-global/009)', () => {
  const refs = (src: string, file = 'src/lib/store.svelte.ts') => parseComponentFacts(src, file).browserGlobalRefs;

  it('flags bare and member-object reads at module scope', () => {
    const src = 'const w = window.innerWidth;\nlocalStorage.setItem("k", "v");\ndocument.title = "x";';
    expect(refs(src)).toEqual([
      { name: 'window', line: 1, context: 'module' },
      { name: 'localStorage', line: 2, context: 'module' },
      { name: 'document', line: 3, context: 'module' }
    ]);
  });
  it('does not flag typeof operands, property keys, or member property names', () => {
    const src =
      'const ok = typeof window;\nconst o = { window: 1, document: 2 };\nconst x = o.window;\napi.localStorage.get();';
    expect(refs(src)).toEqual([]);
  });
  it('does not flag names imported or declared at top level', () => {
    const src =
      "import { window } from 'happy-dom';\nconst document = makeDoc();\nwindow.open();\ndocument.write('x');";
    expect(refs(src)).toEqual([]);
  });
  it('skips browser-guarded clauses entirely (if / ternary / logical, alias included)', () => {
    const src = [
      "import { browser as isBrowser } from '$app/environment';",
      'if (isBrowser) {',
      '  window.scrollTo(0, 0);',
      '} else {',
      '  document.title;',
      '}',
      'const w = isBrowser ? window.innerWidth : 0;',
      'isBrowser && localStorage.clear();'
    ].join('\n');
    expect(refs(src)).toEqual([]);
  });
  it('skips typeof-guarded clauses', () => {
    const src =
      "if (typeof window !== 'undefined') {\n  window.addEventListener('x', f);\n}\nconst s = typeof localStorage === 'undefined' ? null : localStorage.getItem('k');";
    expect(refs(src)).toEqual([]);
  });
  it('does not flag reads inside functions, onMount, or $effect', () => {
    const src = [
      "import { onMount } from 'svelte';",
      'export function width() {',
      '  return window.innerWidth;',
      '}',
      'onMount(() => document.title);',
      '$effect(() => {',
      '  localStorage.setItem("a", "b");',
      '});'
    ].join('\n');
    expect(refs(src)).toEqual([]);
  });
  it('splits module vs instance contexts in .svelte files', () => {
    const src = [
      '<script module>',
      'const w = window.innerWidth;',
      '</script>',
      '<script>',
      "  const stored = localStorage.getItem('k');",
      '</script>'
    ].join('\n');
    expect(parseComponentFacts(src, 'C.svelte').browserGlobalRefs).toEqual([
      { name: 'window', line: 2, context: 'module' },
      { name: 'localStorage', line: 5, context: 'instance' }
    ]);
  });
  it("shares the module script's guard and bindings with the instance scan", () => {
    const src = [
      '<script module>',
      "import { browser } from '$app/environment';",
      'const document = makeDoc();',
      '</script>',
      '<script>',
      '  if (browser) {',
      '    window.scrollTo(0, 0);',
      '  }',
      "  document.write('x');",
      '</script>'
    ].join('\n');
    expect(parseComponentFacts(src, 'C.svelte').browserGlobalRefs).toEqual([]);
  });
  it('does not flag a shadowed name in a top-level block', () => {
    const src = '{\n  const window = fake();\n  window.open();\n}';
    expect(refs(src)).toEqual([]);
  });
  it('never flags TS type-position typeof or type annotations', () => {
    expect(refs('type W = typeof window;\nexport type { W };')).toEqual([]);
    expect(refs('interface Foo {\n  d: typeof document;\n}\nexport const x: Foo | null = null;')).toEqual([]);
    expect(refs('const m = new Map<string, typeof localStorage>();')).toEqual([]);
  });
  it('still scans the runtime expression inside as/satisfies wrappers', () => {
    expect(refs('const w = window.innerWidth as number;')).toEqual([{ name: 'window', line: 1, context: 'module' }]);
    expect(refs('const x = foo as typeof window;')).toEqual([]);
  });
  it('recognises a derived guard binding (one level)', () => {
    const src = [
      "import { browser } from '$app/environment';",
      'const canUse = browser && !!window.matchMedia;',
      'if (canUse) {',
      '  window.scrollTo(0, 0);',
      '}'
    ].join('\n');
    expect(refs(src)).toEqual([]);
  });
  it('recognises a <script module>-derived guard used in the instance script', () => {
    const src = [
      '<script module>',
      "import { browser } from '$app/environment';",
      'export const canUse = browser;',
      '</script>',
      '<script>',
      '  if (canUse) {',
      '    window.scrollTo(0, 0);',
      '  }',
      '</script>'
    ].join('\n');
    expect(parseComponentFacts(src, 'C.svelte').browserGlobalRefs).toEqual([]);
  });
});

describe('constableStates — directive escapes', () => {
  const constable = (src: string) => parseComponentFacts(src, 'A.svelte').constableStates;

  it('does not report $state handed to a use: directive', () => {
    const src = `<script>\nlet obj = $state({});\n</script>\n<div use:draggable={obj}>x</div>`;
    expect(constable(src)).toEqual([]);
  });

  it('does not report $state handed to a transition: directive', () => {
    const src = `<script>\nlet params = $state({ duration: 200 });\n</script>\n<div transition:fly={params}>x</div>`;
    expect(constable(src)).toEqual([]);
  });

  it('still reports untouched $state, including next to unrelated directives', () => {
    const src = `<script>\nlet obj = $state({});\nlet other = $state({});\n</script>\n<div use:draggable={other}>x</div>`;
    expect(constable(src)).toEqual([{ name: 'obj', line: 2 }]);
  });
});

describe('constableStates — {@const} shadowing', () => {
  const constable = (src: string) => parseComponentFacts(src, 'A.svelte').constableStates;

  it('does not attribute a write to an {@const} alias to a same-named untouched $state', () => {
    const src = `<script>\nlet obj = $state({});\n</script>\n{#each list as g}{@const obj = g.o}<button onclick={() => {\n  obj.x = 1;\n}}>x</button>{/each}`;
    expect(constable(src)).toEqual([{ name: 'obj', line: 2 }]);
  });

  it('does not attribute a reassignment of a {let} declaration tag to a same-named untouched $state', () => {
    const src = `<script>\nlet obj = $state({});\n</script>\n{#each list as g}{let obj = g.o}<button onclick={() => {\n  obj = g.p;\n}}>x</button>{/each}`;
    expect(constable(src)).toEqual([{ name: 'obj', line: 2 }]);
  });
});

describe('parseComponentFacts — type-only imports in importSpans', () => {
  const spans = (src: string) => parseComponentFacts(src, 'src/routes/a/+page.svelte').importSpans;

  it('marks a declaration-level type import', () => {
    expect(spans(`<script lang="ts">import type P from './+page.svelte';</script>`)).toEqual([
      { source: './+page.svelte', line: 1, type: true }
    ]);
  });

  it('marks a declaration whose every specifier is inline-typed', () => {
    expect(spans(`<script lang="ts">import { type A, type B } from './x.js';</script>`)).toEqual([
      { source: './x.js', line: 1, type: true }
    ]);
  });

  it('leaves a value import unmarked', () => {
    expect(spans(`<script>import X from './X.svelte';</script>`)).toEqual([{ source: './X.svelte', line: 1 }]);
  });

  it('leaves a mixed value/type declaration unmarked', () => {
    expect(spans(`<script lang="ts">import X, { type A } from './X.svelte';</script>`)).toEqual([
      { source: './X.svelte', line: 1 }
    ]);
  });

  it('leaves a side-effect import unmarked', () => {
    // No specifiers at all is NOT a type import — the module is loaded for its side effects.
    expect(spans(`<script>import './setup.js';</script>`)).toEqual([{ source: './setup.js', line: 1 }]);
  });
});

describe('parseComponentFacts — links inside comments', () => {
  const links = (src: string) => parseComponentFacts(src, 'src/lib/A/A.svelte').commentLinks;

  it('finds a link in a markup comment', () => {
    expect(links(`<!-- see [guide](https://x.test/a/b) -->\n<p>hi</p>`)).toEqual([
      { url: 'https://x.test/a/b', line: 1 }
    ]);
  });

  it('finds a link in a markup comment spanning lines', () => {
    const src = ['<!--', '  see [guide](https://x.test/a/b)', '-->'].join('\n');
    expect(links(src)).toEqual([{ url: 'https://x.test/a/b', line: 2 }]);
  });

  it('finds a link in a script line comment', () => {
    expect(links(`<script>\n  // see [guide](https://x.test/a/b)\n</script>`)).toEqual([
      { url: 'https://x.test/a/b', line: 2 }
    ]);
  });

  it('ignores a link in rendered markup', () => {
    // Not a reference to a repository path — it is content.
    expect(links(`<p>see [guide](https://x.test/a/b)</p>`)).toEqual([]);
  });

  it('is not fooled by the // inside a URL', () => {
    // A scan that treated `//` as a comment opener would read the rest of this line as a comment.
    expect(links(`<script>\n  const u = 'https://x.test/[a](b)';\n</script>`)).toEqual([]);
  });

  it('ignores a trailing // comment on a line of code', () => {
    // Documented as not reported: `//` opens a comment only at the start of a line, which is what keeps
    // the scan off the `//` in a URL.
    expect(links(`<script>\n  const x = 1; // see [guide](https://x.test/a/b)\n</script>`)).toEqual([]);
  });

  it('ignores a link inside a block or JSDoc comment', () => {
    // Documented as not reported: only the markup form and a line-leading `//` are scanned.
    expect(links(`<script>\n  /** see [guide](https://x.test/a/b) */\n</script>`)).toEqual([]);
    expect(links(`<script>\n  /* see [guide](https://x.test/a/b) */\n</script>`)).toEqual([]);
  });

  it('finds every link on one line', () => {
    expect(links(`<!-- [a](https://x.test/1) and [b](https://x.test/2) -->`)).toEqual([
      { url: 'https://x.test/1', line: 1 },
      { url: 'https://x.test/2', line: 1 }
    ]);
  });

  it('records nothing for a component with no comments', () => {
    expect(links(`<p>hi</p>`)).toEqual([]);
  });

  it('does not leak comment state from a <!-- inside a script string literal', () => {
    // Without script-block tracking, `open` stays true past `</script>` and the markup
    // link below is misread as comment text.
    const src = ['<script>', "  const s = '<!-- x';", '</script>', '<p>see [guide](https://x.test/a/b)</p>'].join('\n');
    expect(links(src)).toEqual([]);
  });

  it('does not treat a markup line beginning with // as a comment', () => {
    // `//` only opens a comment inside a <script> block; in markup it is content.
    const src = ['<p>', '// see [guide](https://x.test/a/b)', '</p>'].join('\n');
    expect(links(src)).toEqual([]);
  });

  it('does not open a script block from a commented-out <script> tag', () => {
    // The tag never gets a matching `</script>`, so opening a block there would stay open and skip
    // every comment in the rest of the file — the link on the tag's own line included.
    const src = ['<!-- <script> [a](https://x.test/1) -->', '<!-- [b](https://x.test/2) -->', '<p>hi</p>'].join('\n');
    expect(links(src)).toEqual([
      { url: 'https://x.test/1', line: 1 },
      { url: 'https://x.test/2', line: 2 }
    ]);
  });

  it('does not open a style block from a commented-out <style> tag', () => {
    const src = ['<!-- <style> [a](https://x.test/1) -->', '<!-- [b](https://x.test/2) -->'].join('\n');
    expect(links(src)).toEqual([
      { url: 'https://x.test/1', line: 1 },
      { url: 'https://x.test/2', line: 2 }
    ]);
  });

  it('still tracks a real script block opened on a line that also holds a comment', () => {
    // The tag sits in the markup outside the comment, so it opens the block as usual.
    const src = [
      '<!-- [a](https://x.test/1) --><script>',
      "  const s = '<!-- x';",
      '</script>',
      '<p>[b](https://x.test/2)</p>'
    ].join('\n');
    expect(links(src)).toEqual([{ url: 'https://x.test/1', line: 1 }]);
  });

  it('finds a link in a runes module (.svelte.ts) comment', () => {
    // Exercises the parseModuleFacts wiring, not parseComponentFacts's .svelte path.
    const facts = parseComponentFacts(
      '// see [guide](https://x.test/a/b)\nlet c = $state(0);',
      'src/lib/store.svelte.ts'
    );
    expect(facts.commentLinks).toEqual([{ url: 'https://x.test/a/b', line: 1 }]);
  });
});
