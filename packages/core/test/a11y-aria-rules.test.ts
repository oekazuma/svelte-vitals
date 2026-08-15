import { describe, it, expect } from 'vitest';
import {
  a11yInvalidRole,
  a11yUnknownAriaAttribute,
  a11yRequiredAriaProps,
  a11yInvalidAriaValue
} from '../src/index.js';
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

describe('a11y/unknown-aria-attribute', () => {
  it('flags aria-* names not in the spec', async () => {
    const rs = await a11yUnknownAriaAttribute.check(
      ctx([comp({ ariaElements: [el({ aria: [{ name: 'aria-lable', literal: 'x', line: 4 }] })] })])
    );
    expect(fails(rs).map((r) => r.line)).toEqual([4]);
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

  it('flags a boolean aria attribute with a non-boolean literal', async () => {
    const rs = await a11yInvalidAriaValue.check(
      ctx([comp({ ariaElements: [el({ aria: [{ name: 'aria-hidden', literal: 'yes', line: 7 }] })] })])
    );
    expect(fails(rs).map((r) => r.line)).toEqual([7]);
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
