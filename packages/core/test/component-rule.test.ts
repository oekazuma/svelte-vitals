import { describe, it, expect } from 'vitest';
import { componentRule } from '../src/rules/component-rule.js';
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
  importSpans: [],
  namespaceImports: [],
  constableStates: [],
  mutatedProps: [],
  stalePropDerivations: [],
  rawableStates: [],
  nonreactiveBuiltinStates: [],
  orphanEffects: [],
  orphanLifecycleCalls: [],
  browserGlobalRefs: [],
  moduleStateDecls: [],
  suppressions: [],
  ...over
});

// A minimal fake rule with one hard-coded bad occurrence at line 5, so each test
// controls suppression purely through comp({ suppressions: [...] }).
const fakeRule = componentRule({
  id: 'FAKE001',
  title: 'Fake rule',
  category: 'correctness',
  label: 'Fake check',
  recommendation: 'n/a',
  rationale: 'n/a',
  applies: () => true,
  bad: () => [{ line: 5, message: 'fake violation' }]
});

describe('componentRule — inline suppression directives (issue #92)', () => {
  it('flags the violation when there is no suppression', async () => {
    const rs = await fakeRule.check(ctx([comp({})]));
    expect(fails(rs)).toHaveLength(1);
  });
  it('suppresses the violation when a directive matches its line and rule id', async () => {
    const rs = await fakeRule.check(ctx([comp({ suppressions: [{ line: 5, ruleIds: ['FAKE001'] }] })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // falls back to the normal PASS result
  });
  it('does not suppress when the directive targets a different rule id', async () => {
    const rs = await fakeRule.check(ctx([comp({ suppressions: [{ line: 5, ruleIds: ['OTHER999'] }] })]));
    expect(fails(rs)).toHaveLength(1);
  });
  it('suppresses regardless of rule id when the directive is blanket (no ruleIds)', async () => {
    const rs = await fakeRule.check(ctx([comp({ suppressions: [{ line: 5 }] })]));
    expect(fails(rs)).toHaveLength(0);
  });
  it('does not suppress when the directive is on a different line', async () => {
    const rs = await fakeRule.check(ctx([comp({ suppressions: [{ line: 6, ruleIds: ['FAKE001'] }] })]));
    expect(fails(rs)).toHaveLength(1);
  });
});
