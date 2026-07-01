import { describe, it, expect } from 'vitest';
import { arch001ComponentSize, arch002PropCount } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: { detection: { presence: string; value: string } }[]) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (components: ComponentFacts[]): RuleContext => ({ components, ...base });
const comp = (over: Partial<ComponentFacts>): ComponentFacts => ({
  file: 'src/lib/C.svelte',
  eachBlocks: [],
  effects: [],
  htmlTags: [],
  javascriptUrls: [],
  loc: 10,
  propCount: 0,
  imports: [],
  namespaceImports: [],
  ...over
});

describe('ARCH001 component size', () => {
  it('flags a component over the line limit', async () => {
    const rs = await arch001ComponentSize.check(ctx([comp({ loc: 500 })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('architecture');
    expect(rs[0]!.severity).toBe('info');
    expect(rs[0]!.message).toContain('500');
  });
  it('passes a small component', async () => {
    const rs = await arch001ComponentSize.check(ctx([comp({ loc: 50 })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing when the component channel is unset (rendered mode)', async () => {
    expect(await arch001ComponentSize.check(base as RuleContext)).toHaveLength(0);
  });
  it('skips an unanalyzable component (loc 0 = read/parse failure), not a PASS', async () => {
    expect(await arch001ComponentSize.check(ctx([comp({ loc: 0 })]))).toHaveLength(0);
  });
});

describe('ARCH002 prop count', () => {
  it('flags a component with too many props', async () => {
    const rs = await arch002PropCount.check(ctx([comp({ propCount: 15 })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('15');
  });
  it('passes a component with few props', async () => {
    const rs = await arch002PropCount.check(ctx([comp({ propCount: 3 })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a component with no countable props', async () => {
    expect(await arch002PropCount.check(ctx([comp({ propCount: 0 })]))).toHaveLength(0);
  });
});
