import { describe, it, expect } from 'vitest';
import { performanceHeavyImport, performanceNamespaceImport } from '../src/index.js';
import { defineConfig, defaultProject, type Result } from '../src/types.js';
import type { ComponentFacts, SuppressionDirective } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';
import { parseComponentFacts } from '../src/component-parse.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (components: ComponentFacts[]): RuleContext => ({ components, ...base });
const comp = (
  importSpans: ComponentFacts['importSpans'],
  suppressions: SuppressionDirective[] = []
): ComponentFacts => ({
  file: 'src/lib/C.svelte',
  eachBlocks: [],
  effects: [],
  htmlTags: [],
  javascriptUrls: [],
  loc: 10,
  propCount: 0,
  imports: importSpans.map((s) => s.source),
  importSpans,
  namespaceImports: [],
  constableStates: [],
  mutatedProps: [],
  stalePropDerivations: [],
  rawableStates: [],
  nonreactiveBuiltinStates: [],
  checkableBindValues: [],
  basePathLinks: [],
  orphanEffects: [],
  orphanLifecycleCalls: [],
  browserGlobalRefs: [],
  moduleStateDecls: [],
  suppressions,
  commentLinks: []
});

describe('performance/heavy-import heavy dependency import', () => {
  it('flags a bare lodash / moment import', async () => {
    const rs = await performanceHeavyImport.check(
      ctx([
        comp([
          { source: 'lodash', line: 1 },
          { source: 'svelte', line: 2 }
        ])
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('performance');
    expect(rs[0]!.message).toContain('lodash');
  });
  it('reports the real source line of the heavy import instead of line 0', async () => {
    const rs = await performanceHeavyImport.check(ctx([comp([{ source: 'lodash', line: 5 }])]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.line).toBe(5);
  });
  it('does not flag a subpath import or a light dependency', async () => {
    const rs = await performanceHeavyImport.check(
      ctx([
        comp([
          { source: 'lodash/debounce', line: 1 },
          { source: 'date-fns', line: 2 }
        ])
      ])
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // a passing seed
  });
  it('does not match inherited Object keys (e.g. "toString")', async () => {
    const rs = await performanceHeavyImport.check(
      ctx([
        comp([
          { source: 'toString', line: 1 },
          { source: 'constructor', line: 2 }
        ])
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('dedupes the same heavy package imported twice, reporting the first-seen line', async () => {
    const rs = await performanceHeavyImport.check(
      ctx([
        comp([
          { source: 'lodash', line: 3 },
          { source: 'lodash', line: 8 }
        ])
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.line).toBe(3);
  });
  it('emits nothing for a component with no imports', async () => {
    expect(await performanceHeavyImport.check(ctx([comp([])]))).toHaveLength(0);
  });
  // This rule's claim is bundle weight, and a type-only import contributes none: it is erased
  // at build. Reporting it was a false positive in a default-on rule.
  it('does not flag a type-only import of a heavy package', async () => {
    const rs = await performanceHeavyImport.check(ctx([comp([{ source: 'moment', line: 1, type: true }])]));
    expect(fails(rs)).toEqual([]);
  });
  it('still flags a value import alongside a type-only one, at its own line', async () => {
    // Guards the obvious over-correction: skipping the type span must not skip the file.
    const rs = await performanceHeavyImport.check(
      ctx([
        comp([
          { source: 'moment', line: 1, type: true },
          { source: 'lodash', line: 2 }
        ])
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.line).toBe(2);
  });
  it('still passes a file whose only imports are type-only, rather than falling silent', async () => {
    // `applies` is deliberately unchanged: "we checked this file's imports and found no heavy
    // ones" stays a true statement, and dropping the pass would move scores as a side effect.
    const rs = await performanceHeavyImport.check(ctx([comp([{ source: 'moment', line: 1, type: true }])]));
    expect(rs.filter((r) => r.detection.presence === 'own')).toHaveLength(1);
  });
  it('emits nothing when the component channel is unset (rendered mode)', async () => {
    expect(await performanceHeavyImport.check(base as RuleContext)).toHaveLength(0);
  });
  // Regression for the bug this plan fixes: performance/heavy-import used to hard-code `line: 0`, and
  // component-rule's suppression check only looks up a directive when `b.line > 0` —
  // so `svelte-vitals-disable-next-line performance/heavy-import` silently never suppressed anything.
  it('suppresses the finding when a directive matches its real line and rule id', async () => {
    const rs = await performanceHeavyImport.check(
      ctx([comp([{ source: 'lodash', line: 5 }], [{ line: 5, ruleIds: ['performance/heavy-import'] }])])
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // falls back to the normal PASS result
  });
  it('does not suppress when the directive is on a different line', async () => {
    const rs = await performanceHeavyImport.check(
      ctx([comp([{ source: 'lodash', line: 5 }], [{ line: 6, ruleIds: ['performance/heavy-import'] }])])
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('end-to-end: fires on a runes module importing a heavy package (was silently never checked)', async () => {
    const facts = parseComponentFacts("import moment from 'moment';\nlet c = $state(0);", 'src/lib/state.svelte.ts');
    const rs = await performanceHeavyImport.check(ctx([{ file: 'src/lib/state.svelte.ts', ...facts }]));
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('moment');
  });

  const cfgCtx = (components: ComponentFacts[], cfg: Parameters<typeof defineConfig>[0]): RuleContext => ({
    components,
    heads: [],
    project: defaultProject,
    config: defineConfig(cfg)
  });
  const extra = {
    rules: { 'performance/heavy-import': { options: { packages: { 'chart.js': 'import chart.js/auto' } } } }
  };

  it('still flags the built-in heavy packages', async () => {
    const rs = await performanceHeavyImport.check(ctx([comp([{ source: 'lodash', line: 3 }])]));
    expect(fails(rs)).toHaveLength(1);
  });
  it('flags a package added through config', async () => {
    const rs = await performanceHeavyImport.check(cfgCtx([comp([{ source: 'chart.js', line: 2 }])], extra));
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('import chart.js/auto');
  });
  it('keeps the built-ins when config adds a package', async () => {
    const rs = await performanceHeavyImport.check(cfgCtx([comp([{ source: 'moment', line: 1 }])], extra));
    expect(fails(rs)).toHaveLength(1);
  });
  it('leaves an unlisted package alone', async () => {
    const rs = await performanceHeavyImport.check(cfgCtx([comp([{ source: 'dayjs', line: 1 }])], extra));
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('performance/namespace-import namespace import', () => {
  const withNs = (namespaceImports: { source: string; line: number }[]): ComponentFacts => ({
    ...comp([]),
    namespaceImports
  });

  it('flags a bare namespace import', async () => {
    const rs = await performanceNamespaceImport.check(ctx([withNs([{ source: 'lodash', line: 2 }])]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('performance');
    expect(rs[0]!.message).toContain('lodash');
  });
  it('dedupes the same package imported twice, reporting the earliest line', async () => {
    // Collection order is module-then-instance, not always source order; report the min line.
    const rs = await performanceNamespaceImport.check(
      ctx([
        withNs([
          { source: 'lodash', line: 5 },
          { source: 'lodash', line: 2 }
        ])
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.line).toBe(2);
  });
  it('reports one finding per distinct package', async () => {
    const rs = await performanceNamespaceImport.check(
      ctx([
        withNs([
          { source: 'lodash', line: 2 },
          { source: 'three', line: 3 }
        ])
      ])
    );
    expect(fails(rs)).toHaveLength(2);
  });
  it('passes a component with no namespace imports', async () => {
    const rs = await performanceNamespaceImport.check(ctx([withNs([])]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(0); // applies() is false → no signal
  });
});
