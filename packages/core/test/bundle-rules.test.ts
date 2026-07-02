import { describe, it, expect } from 'vitest';
import { perf009HeavyImport, perf010NamespaceImport } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: { detection: { presence: string; value: string } }[]) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (components: ComponentFacts[]): RuleContext => ({ components, ...base });
const comp = (imports: string[]): ComponentFacts => ({
  file: 'src/lib/C.svelte',
  eachBlocks: [],
  effects: [],
  htmlTags: [],
  javascriptUrls: [],
  loc: 10,
  propCount: 0,
  imports,
  namespaceImports: [],
  constableStates: []
});

describe('PERF009 heavy dependency import', () => {
  it('flags a bare lodash / moment import', async () => {
    const rs = await perf009HeavyImport.check(ctx([comp(['lodash', 'svelte'])]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('performance');
    expect(rs[0]!.message).toContain('lodash');
  });
  it('does not flag a subpath import or a light dependency', async () => {
    const rs = await perf009HeavyImport.check(ctx([comp(['lodash/debounce', 'date-fns'])]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // a passing seed
  });
  it('does not match inherited Object keys (e.g. "toString")', async () => {
    const rs = await perf009HeavyImport.check(ctx([comp(['toString', 'constructor'])]));
    expect(fails(rs)).toHaveLength(0);
  });
  it('dedupes the same heavy package imported twice (one finding)', async () => {
    const rs = await perf009HeavyImport.check(ctx([comp(['lodash', 'lodash'])]));
    expect(fails(rs)).toHaveLength(1);
  });
  it('emits nothing for a component with no imports', async () => {
    expect(await perf009HeavyImport.check(ctx([comp([])]))).toHaveLength(0);
  });
  it('emits nothing when the component channel is unset (rendered mode)', async () => {
    expect(await perf009HeavyImport.check(base as RuleContext)).toHaveLength(0);
  });
});

describe('PERF010 namespace import', () => {
  const withNs = (namespaceImports: { source: string; line: number }[]): ComponentFacts => ({
    ...comp([]),
    namespaceImports
  });

  it('flags a bare namespace import', async () => {
    const rs = await perf010NamespaceImport.check(ctx([withNs([{ source: 'lodash', line: 2 }])]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('performance');
    expect(rs[0]!.message).toContain('lodash');
  });
  it('dedupes the same package imported twice, reporting the earliest line', async () => {
    // Collection order is module-then-instance, not always source order; report the min line.
    const rs = await perf010NamespaceImport.check(
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
    const rs = await perf010NamespaceImport.check(
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
    const rs = await perf010NamespaceImport.check(ctx([withNs([])]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(0); // applies() is false → no signal
  });
});
