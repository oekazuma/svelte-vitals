import { describe, it, expect } from 'vitest';
import {
  a11yInvalidRole,
  a11yUnknownAriaAttribute,
  a11yRequiredAriaProps,
  a11yInvalidAriaValue
} from '../src/internal.js';
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
  it('accepts a fallback list once a token names a concrete role', async () => {
    // A user agent resolves to the first concrete token, so the later ones are the spec's own
    // progressive-enhancement form — flagging them warned on correct markup.
    const rs = await a11yInvalidRole.check(
      ctx([
        comp({
          ariaElements: [
            el({ role: { literal: 'switch bogus' } }),
            el({ role: { literal: 'widget checkbox' }, line: 5 })
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('flags a fallback list in which no token resolves', async () => {
    const rs = await a11yInvalidRole.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'bogus alsobogus' } })] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('no token in role="bogus alsobogus"');
  });
  it('accepts roles ARIA 1.3 added after the pinned aria-query snapshot', async () => {
    const rs = await a11yInvalidRole.check(
      ctx([
        comp({
          ariaElements: ['comment', 'image', 'sectionheader', 'sectionfooter', 'suggestion'].map((r, i) =>
            el({ role: { literal: r }, line: i + 1 })
          )
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('passes known roles and skips expressions', async () => {
    const rs = await a11yInvalidRole.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'button' } }), el({ role: { expression: true } })] })])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('a11y/unknown-aria-attribute', () => {
  it('accepts attributes ARIA 1.3 added after the pinned aria-query snapshot', async () => {
    const rs = await a11yUnknownAriaAttribute.check(
      ctx([
        comp({
          ariaElements: [
            el({ aria: [{ name: 'aria-colindextext', literal: 'Q1', line: 1 }] }),
            el({ aria: [{ name: 'aria-rowindextext', literal: 'B', line: 2 }] })
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('flags aria-* names not in the spec', async () => {
    const rs = await a11yUnknownAriaAttribute.check(
      ctx([comp({ ariaElements: [el({ aria: [{ name: 'aria-lable', literal: 'x', line: 4 }] })] })])
    );
    // Anchored at the element's start tag (line 3), not the attribute's line 4, so a directive reaches it.
    expect(fails(rs).map((r) => r.line)).toEqual([3]);
  });
  it('passes known names regardless of value form', async () => {
    const rs = await a11yUnknownAriaAttribute.check(
      ctx([
        comp({
          ariaElements: [
            el({
              aria: [
                { name: 'aria-label', literal: 'x', line: 4 },
                { name: 'aria-hidden', expression: true, line: 5 }
              ]
            })
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('a11y/required-aria-props', () => {
  it('requires nothing of option and treeitem', async () => {
    // aria-query carries an ARIA 1.1 `aria-selected` requirement for both; neither 1.2 nor the 1.3
    // draft lists any, so idiomatic listbox and tree markup was being flagged.
    const rs = await a11yRequiredAriaProps.check(
      ctx([
        comp({
          ariaElements: [
            el({ tag: 'li', role: { literal: 'option' } }),
            el({ tag: 'li', role: { literal: 'treeitem' }, line: 5 })
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('checks the role a fallback list resolves to', async () => {
    const rs = await a11yRequiredAriaProps.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'bogus checkbox' } })] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('(resolves to checkbox)');
  });
  it('flags a role missing its required props', async () => {
    const rs = await a11yRequiredAriaProps.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'checkbox' } })] })])
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('satisfied by a literal or expression attribute', async () => {
    const rs = await a11yRequiredAriaProps.check(
      ctx([
        comp({
          ariaElements: [
            el({ role: { literal: 'checkbox' }, aria: [{ name: 'aria-checked', expression: true, line: 3 }] })
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('satisfied by host-element native semantics', async () => {
    const rs = await a11yRequiredAriaProps.check(
      ctx([comp({ ariaElements: [el({ tag: 'input', inputType: 'checkbox', role: { literal: 'switch' } })] })])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('treats <select> and <input list> as native comboboxes whose aria-expanded the host supplies', async () => {
    const rs = await a11yRequiredAriaProps.check(
      ctx([
        comp({
          ariaElements: [
            el({ tag: 'select', role: { literal: 'combobox' } }),
            el({ line: 5, tag: 'input', inputType: 'text', hasList: true, role: { literal: 'combobox' } }),
            // A plain <input role="combobox"> still owes aria-expanded.
            el({ line: 8, tag: 'input', inputType: 'text', role: { literal: 'combobox' } })
          ]
        })
      ])
    );
    expect(fails(rs).map((r) => r.line)).toEqual([8]);
  });
  it('satisfied by a spread attribute — its full attribute set is unknowable', async () => {
    const rs = await a11yRequiredAriaProps.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'checkbox' }, hasSpread: true })] })])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('a11y/invalid-aria-value', () => {
  it('flags a blank literal for a number-typed attribute', async () => {
    const rs = await a11yInvalidAriaValue.check(
      ctx([comp({ ariaElements: [el({ aria: [{ name: 'aria-valuenow', literal: '', line: 2 }] })] })])
    );
    expect(fails(rs)).toHaveLength(1);
  });

  it('rejects an empty token list — a token list is one or more tokens', async () => {
    const rs = await a11yInvalidAriaValue.check(
      ctx([
        comp({
          ariaElements: [
            el({ aria: [{ name: 'aria-relevant', literal: '', line: 3 }] }),
            el({ line: 9, aria: [{ name: 'aria-relevant', literal: 'additions text', line: 9 }] })
          ]
        })
      ])
    );
    expect(fails(rs).map((r) => r.line)).toEqual([3]);
  });

  it('flags a boolean aria attribute with a non-boolean literal', async () => {
    const rs = await a11yInvalidAriaValue.check(
      ctx([comp({ ariaElements: [el({ aria: [{ name: 'aria-hidden', literal: 'yes', line: 7 }] })] })])
    );
    // Start-tag anchor (the element's line 3), for directive reachability on multi-line elements.
    expect(fails(rs).map((r) => r.line)).toEqual([3]);
  });
  it('passes valid literals, expressions, and unknown attributes (owned by unknown-aria-attribute)', async () => {
    const rs = await a11yInvalidAriaValue.check(
      ctx([
        comp({
          ariaElements: [
            el({
              aria: [
                { name: 'aria-hidden', literal: 'true', line: 3 },
                { name: 'aria-live', literal: 'polite', line: 4 },
                { name: 'aria-hidden', expression: true, line: 5 },
                { name: 'aria-bogus', literal: 'zzz', line: 6 }
              ]
            })
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('flags an integer type with a non-integer literal', async () => {
    const rs = await a11yInvalidAriaValue.check(
      ctx([comp({ ariaElements: [el({ aria: [{ name: 'aria-colcount', literal: 'many', line: 2 }] })] })])
    );
    expect(fails(rs)).toHaveLength(1);
  });
});
