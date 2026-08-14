import { describe, it, expect } from 'vitest';
import { a11yInteractiveNesting } from '../src/index.js';
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

describe('a11y/interactive-nesting', () => {
  it('flags a recorded nesting', async () => {
    const rs = await a11yInteractiveNesting.check(
      ctx([comp({ interactiveNestings: [{ containerTag: 'a', descendantTag: 'button', line: 2 }] })])
    );
    expect(fails(rs).map((r) => r.line)).toEqual([2]);
  });
  it('passes a component with no recorded nesting', async () => {
    const rs = await a11yInteractiveNesting.check(ctx([comp({ interactiveNestings: [] })]));
    expect(fails(rs)).toHaveLength(0);
  });
});
