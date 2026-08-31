import { describe, expect, it } from 'vitest';
import { resolveLandmark, type LandmarkInput } from '../src/a11y.js';
import { isClassicScriptType } from '../src/head.js';

const base: LandmarkInput = {
  tag: undefined,
  roleTokens: undefined,
  named: false,
  insideSectioning: false,
  insideAsideDemoting: false
};

describe('resolveLandmark', () => {
  it('maps a landmark role token to its kind', () => {
    expect(resolveLandmark({ ...base, roleTokens: ['banner'] })).toBe('banner');
  });

  it('resolves an ARIA fallback list to its first concrete role', () => {
    expect(resolveLandmark({ ...base, roleTokens: ['notarole', 'complementary'] })).toBe('complementary');
  });

  it('a present role attribute suppresses the tag mapping even when it resolves to nothing', () => {
    expect(resolveLandmark({ ...base, tag: 'main', roleTokens: [] })).toBeUndefined();
    expect(resolveLandmark({ ...base, tag: 'main', roleTokens: ['presentation'] })).toBeUndefined();
  });

  it('maps main/header/footer tags outside sectioning content', () => {
    expect(resolveLandmark({ ...base, tag: 'main' })).toBe('main');
    expect(resolveLandmark({ ...base, tag: 'header' })).toBe('banner');
    expect(resolveLandmark({ ...base, tag: 'footer' })).toBe('contentinfo');
  });

  it('demotes header/footer inside sectioning content, but not main', () => {
    expect(resolveLandmark({ ...base, tag: 'header', insideSectioning: true })).toBeUndefined();
    expect(resolveLandmark({ ...base, tag: 'footer', insideSectioning: true })).toBeUndefined();
    expect(resolveLandmark({ ...base, tag: 'main', insideSectioning: true })).toBe('main');
  });

  it('an aside inside demoting content is a landmark only when named', () => {
    expect(resolveLandmark({ ...base, tag: 'aside' })).toBe('complementary');
    expect(resolveLandmark({ ...base, tag: 'aside', insideAsideDemoting: true })).toBeUndefined();
    expect(resolveLandmark({ ...base, tag: 'aside', insideAsideDemoting: true, named: true })).toBe('complementary');
  });

  it('yields nothing for non-landmark or unknown tags', () => {
    expect(resolveLandmark({ ...base, tag: 'div' })).toBeUndefined();
    expect(resolveLandmark(base)).toBeUndefined();
  });
});

describe('isClassicScriptType', () => {
  it('treats an absent or empty type as classic', () => {
    expect(isClassicScriptType(undefined)).toBe(true);
    expect(isClassicScriptType('')).toBe(true);
    expect(isClassicScriptType('  ')).toBe(true);
  });

  it('accepts JavaScript MIME types case-insensitively', () => {
    expect(isClassicScriptType('text/javascript')).toBe(true);
    expect(isClassicScriptType(' Text/JavaScript ')).toBe(true);
  });

  it('rejects non-classic types', () => {
    expect(isClassicScriptType('module')).toBe(false);
    expect(isClassicScriptType('application/ld+json')).toBe(false);
    expect(isClassicScriptType('text/partytown')).toBe(false);
  });
});
