import { describe, it, expect } from 'vitest';
import { a11yInvalidRole } from '../src/index.js';
import { defineConfig, defaultProject, type Result } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
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
  checkableBindValues: [],
  basePathLinks: [],
  orphanEffects: [],
  orphanLifecycleCalls: [],
  browserGlobalRefs: [],
  moduleStateDecls: [],
  suppressions: [],
  commentLinks: [],
  ...over
});

const el = (over: Partial<NonNullable<ComponentFacts['ariaElements']>[number]>) => ({
  tag: 'div',
  line: 3,
  aria: [],
  ...over
});

describe('a11y/invalid-role', () => {
  it('flags an unknown role and an abstract role', async () => {
    const rs = await a11yInvalidRole.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'bogus' } }), el({ role: { literal: 'widget' }, line: 5 })] })])
    );
    expect(fails(rs).map((r) => r.line)).toEqual([3, 5]);
  });
  it('validates every token of a fallback list', async () => {
    const rs = await a11yInvalidRole.check(ctx([comp({ ariaElements: [el({ role: { literal: 'switch bogus' } })] })]));
    expect(fails(rs)).toHaveLength(1);
  });
  it('passes known roles and skips expressions', async () => {
    const rs = await a11yInvalidRole.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'button' } }), el({ role: { expression: true } })] })])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});
