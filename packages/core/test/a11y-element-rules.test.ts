import { describe, it, expect } from 'vitest';
import {
  a11yInteractiveNesting,
  a11yAccessibleName,
  a11yLabelHasControl,
  a11yUseList,
  a11yPlaceholderLabelOption,
  a11yRequireDatetime,
  a11yDoctype
} from '../src/index.js';
import { defineConfig, defaultProject, type Project, type Result } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (components: ComponentFacts[]): RuleContext => ({ components, ...base });
const projCtx = (p: Partial<Project>): RuleContext => ({ heads: [], config, project: { ...defaultProject, ...p } });
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

describe('a11y/accessible-name', () => {
  it('flags a recorded unnamed interactive element', async () => {
    const rs = await a11yAccessibleName.check(ctx([comp({ unnamedInteractive: [{ tag: 'button', line: 3 }] })]));
    const failing = fails(rs);
    expect(failing.map((r) => r.line)).toEqual([3]);
    expect(failing[0]?.message).toBe('<button> has no accessible name');
  });
  it('passes a component with no recorded unnamed interactive elements', async () => {
    const rs = await a11yAccessibleName.check(ctx([comp({ unnamedInteractive: [] })]));
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('a11y/label-has-control', () => {
  it('flags a recorded unassociated label', async () => {
    const rs = await a11yLabelHasControl.check(ctx([comp({ unassociatedLabels: [{ line: 4 }] })]));
    const failing = fails(rs);
    expect(failing.map((r) => r.line)).toEqual([4]);
    expect(failing[0]?.message).toBe('<label> has no associated control');
  });
  it('passes a component with no recorded unassociated labels', async () => {
    const rs = await a11yLabelHasControl.check(ctx([comp({ unassociatedLabels: [] })]));
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('a11y/use-list', () => {
  it('flags a recorded bullet text as info severity', async () => {
    const rs = await a11yUseList.check(ctx([comp({ bulletTexts: [{ line: 2, char: '•' }] })]));
    const failing = fails(rs);
    expect(failing.map((r) => r.line)).toEqual([2]);
    expect(failing[0]?.message).toBe("Text starts with a bullet character ('•') — use a list element");
    expect(failing[0]?.severity).toBe('info');
  });
  it('passes a component with no recorded bullet texts', async () => {
    const rs = await a11yUseList.check(ctx([comp({ bulletTexts: [] })]));
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('a11y/placeholder-label-option', () => {
  it('flags a recorded select missing a placeholder', async () => {
    const rs = await a11yPlaceholderLabelOption.check(ctx([comp({ selectsMissingPlaceholder: [{ line: 5 }] })]));
    const failing = fails(rs);
    expect(failing.map((r) => r.line)).toEqual([5]);
    expect(failing[0]?.message).toBe('<select required> is missing a placeholder label option');
  });
  it('passes a component with no recorded selects missing a placeholder', async () => {
    const rs = await a11yPlaceholderLabelOption.check(ctx([comp({ selectsMissingPlaceholder: [] })]));
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('a11y/require-datetime', () => {
  it('flags a recorded time missing a datetime attribute', async () => {
    const rs = await a11yRequireDatetime.check(
      ctx([comp({ timesMissingDatetime: [{ line: 6, text: 'last Tuesday' }] })])
    );
    const failing = fails(rs);
    expect(failing.map((r) => r.line)).toEqual([6]);
    expect(failing[0]?.message).toBe(
      '<time> content "last Tuesday" is not machine-readable and has no datetime attribute'
    );
  });
  it('passes a component with no recorded times missing datetime', async () => {
    const rs = await a11yRequireDatetime.check(ctx([comp({ timesMissingDatetime: [] })]));
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('a11y/doctype', () => {
  it('flags a missing doctype, passes a present one, silent when unknown', async () => {
    expect(fails(await a11yDoctype.check(projCtx({ appHtmlDoctype: false })))).toHaveLength(1);
    expect(fails(await a11yDoctype.check(projCtx({ appHtmlDoctype: true })))).toHaveLength(0);
    expect(await a11yDoctype.check(projCtx({}))).toHaveLength(0);
  });
});
