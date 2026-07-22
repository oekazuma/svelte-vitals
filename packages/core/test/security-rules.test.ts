import { describe, it, expect } from 'vitest';
import { securityRawHtml, securityJavascriptUrl } from '../src/index.js';
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
  orphanEffects: [],
  orphanLifecycleCalls: [],
  browserGlobalRefs: [],
  moduleStateDecls: [],
  suppressions: [],
  ...over
});

describe('security/raw-html raw HTML render', () => {
  it('flags a component using {@html}', async () => {
    const rs = await securityRawHtml.check(ctx([comp({ htmlTags: [{ line: 4 }] })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('security');
    expect(rs[0]!.line).toBe(4);
  });
  it('emits nothing for a component without {@html}', async () => {
    expect(await securityRawHtml.check(ctx([comp({})]))).toHaveLength(0);
  });
  it('passes when the {@html} finding is suppressed via a template-side directive (issue #92)', async () => {
    const rs = await securityRawHtml.check(
      ctx([comp({ htmlTags: [{ line: 4 }], suppressions: [{ line: 4, ruleIds: ['security/raw-html'] }] })])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('emits nothing when the component channel is unset (rendered mode)', async () => {
    expect(await securityRawHtml.check(base as RuleContext)).toHaveLength(0);
  });
});

describe('security/javascript-url javascript: URL', () => {
  it('flags a javascript: URL', async () => {
    const rs = await securityJavascriptUrl.check(ctx([comp({ javascriptUrls: [{ line: 7 }] })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('security');
  });
  it('emits nothing without a javascript: URL', async () => {
    expect(await securityJavascriptUrl.check(ctx([comp({})]))).toHaveLength(0);
  });
});
