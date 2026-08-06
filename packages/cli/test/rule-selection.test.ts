import { describe, expect, it } from 'vitest';
import { resolveRuleSelection } from '../src/rule-selection.js';

const X = 'architecture/component-size';
const Y = 'seo/title-presence';

describe('resolveRuleSelection', () => {
  it('returns the file map unchanged when neither flag list is given', () => {
    const fileRules = { [X]: { options: { max: 3 } } } as const;
    expect(resolveRuleSelection({ fileRules })).toEqual(fileRules);
  });

  it('treats empty flag lists as no narrowing and no denial', () => {
    const fileRules = { [X]: { options: { max: 3 } } } as const;
    expect(resolveRuleSelection({ fileRules, allowRules: [], ignoreRules: [] })).toEqual(fileRules);
  });

  it('leaves a named rule absent when the file has no entry for it', () => {
    const out = resolveRuleSelection({ allowRules: [X] });
    expect(Object.hasOwn(out, X)).toBe(false);
  });

  it('keeps a named rule severity from the file', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: 'warning' }, allowRules: [X] });
    expect(out[X]).toBe('warning');
  });

  it('keeps a named rule options object from the file', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: { options: { max: 3 } } }, allowRules: [X] });
    expect(out[X]).toEqual({ options: { max: 3 } });
  });

  it('drops a bare off so a named rule is force-enabled', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: 'off' }, allowRules: [X] });
    expect(Object.hasOwn(out, X)).toBe(false);
  });

  it('force-enables a named rule without losing the options beside its off', () => {
    const out = resolveRuleSelection({
      fileRules: { [X]: { severity: 'off', options: { max: 3 } } },
      allowRules: [X]
    });
    expect(out[X]).toEqual({ options: { max: 3 } });
  });

  it('drops an object setting that carried nothing but off', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: { severity: 'off' } }, allowRules: [X] });
    expect(Object.hasOwn(out, X)).toBe(false);
  });

  it('turns off every registered rule the allow-list does not name', () => {
    const out = resolveRuleSelection({ fileRules: { [Y]: 'warning' }, allowRules: [X] });
    expect(out[Y]).toBe('off');
  });

  it('lets deny beat allow when both name the same rule', () => {
    const out = resolveRuleSelection({ fileRules: { [X]: 'off' }, allowRules: [X], ignoreRules: [X] });
    expect(out[X]).toBe('off');
  });

  it('layers ignore onto the file map without replacing it', () => {
    const out = resolveRuleSelection({
      fileRules: { [X]: { options: { max: 3 } }, [Y]: 'warning' },
      ignoreRules: [Y]
    });
    expect(out[X]).toEqual({ options: { max: 3 } });
    expect(out[Y]).toBe('off');
  });

  it('lets an explicit rules map replace the file map, then narrows it', () => {
    const out = resolveRuleSelection({
      fileRules: { [X]: { options: { max: 3 } } },
      rules: { [X]: 'warning', [Y]: 'warning' },
      allowRules: [X]
    });
    expect(out[X]).toBe('warning'); // from `rules`, not the file's options object
    expect(out[Y]).toBe('off'); // narrowed away
  });

  it('does not mutate its inputs', () => {
    const fileRules = { [X]: 'off' as const };
    resolveRuleSelection({ fileRules, allowRules: [X] });
    expect(fileRules[X]).toBe('off');
  });
});
