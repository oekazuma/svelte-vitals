import { describe, it, expect } from 'vitest';
import { componentRule } from '../src/rules/component-rule.js';
import { applyOverrides } from '../src/config-apply.js';
import { defineConfig, defaultProject, type Result } from '../src/types.js';
import { emptyComponentFacts, type ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (components: ComponentFacts[]): RuleContext => ({ components, ...base });
const comp = (over: Partial<ComponentFacts>): ComponentFacts => ({
  ...emptyComponentFacts('src/lib/C.svelte'),
  loc: 10,
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
  it('a suppressed-to-PASS result carries the same location a penalized result on this file would', async () => {
    const rs = await fakeRule.check(ctx([comp({ suppressions: [{ line: 5, ruleIds: ['FAKE001'] }] })]));
    expect(rs[0]!.location).toBe('src/lib/C.svelte');
  });
});

const multiRule = componentRule({
  id: 'MULTI001',
  title: 'Multi rule',
  category: 'correctness',
  label: 'Multi check',
  recommendation: 'n/a',
  rationale: 'n/a',
  applies: () => true,
  bad: () => [
    { line: 3, message: 'first violation' },
    { line: 9, message: 'second violation' }
  ]
});

describe('componentRule — one finding per bad occurrence', () => {
  it('emits a finding per issue, each at its own line', async () => {
    const rs = await multiRule.check(ctx([comp({})]));
    expect(fails(rs).map((r) => r.line)).toEqual([3, 9]);
  });
});

// A second fake rule that always passes, so a files:-scoped 'off' override has a pure PASS
// seed to remove (the audit's 2608-CORE-03 shape, design 2026-08-08-pass-result-location-design.md).
const cleanRule = componentRule({
  id: 'CLEAN001',
  title: 'Clean rule',
  category: 'correctness',
  label: 'Clean check',
  recommendation: 'n/a',
  rationale: 'n/a',
  applies: () => true,
  bad: () => []
});

describe("componentRule — a files:-scoped 'off' override also removes a PASS seed (2608-CORE-03)", () => {
  it('removes the pass seed for the matched file, leaving other files alone', async () => {
    const rs = await cleanRule.check(
      ctx([comp({ file: 'src/lib/Clean.svelte' }), comp({ file: 'src/lib/Other.svelte' })])
    );
    expect(rs).toHaveLength(2); // both files pass, before any override

    const cfg = { overrides: [{ files: 'src/lib/Clean.svelte', rules: { CLEAN001: 'off' as const } }] };
    const out = applyOverrides(rs, defineConfig(cfg));
    // Before this fix, componentRule's PASS branch carried no `location`, so `files:` could
    // never match it and both results survived.
    expect(out).toHaveLength(1);
    expect(out[0]!.route).toBe('src/lib/Other.svelte');
  });
});
