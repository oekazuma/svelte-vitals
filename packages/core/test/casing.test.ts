import { describe, it, expect } from 'vitest';
import { CASINGS, decodeSegment, parseCasings, satisfiesCasing } from '../src/rules/architecture/casing.js';

describe('CASINGS', () => {
  it('names exactly the four documented casings', () => {
    expect(Object.keys(CASINGS).sort()).toEqual(['PascalCase', 'camelCase', 'kebab-case', 'snake_case']);
  });

  it('tests the whole string, not just the first character', () => {
    expect(CASINGS['camelCase']!.test('recommendHalls')).toBe(true);
    expect(CASINGS['camelCase']!.test('recommend-halls')).toBe(false);
    expect(CASINGS['camelCase']!.test('fair_summary')).toBe(false);
    expect(CASINGS['kebab-case']!.test('recommend-halls')).toBe(true);
    expect(CASINGS['kebab-case']!.test('recommendHalls')).toBe(false);
    expect(CASINGS['PascalCase']!.test('SeoContents')).toBe(true);
    expect(CASINGS['PascalCase']!.test('SEOContents')).toBe(true);
    expect(CASINGS['snake_case']!.test('fair_summary')).toBe(true);
  });

  it('lets one lowercase word satisfy three of the four at once', () => {
    for (const name of ['camelCase', 'kebab-case', 'snake_case']) {
      expect(CASINGS[name]!.test('fair')).toBe(true);
    }
    expect(CASINGS['PascalCase']!.test('fair')).toBe(false);
  });
});

describe('parseCasings', () => {
  it('splits a single name', () => {
    expect(parseCasings('camelCase')).toEqual({ known: ['camelCase'], unknown: [] });
  });

  it('splits several names on the pipe', () => {
    expect(parseCasings('camelCase|PascalCase')).toEqual({ known: ['camelCase', 'PascalCase'], unknown: [] });
  });

  it('separates unknown names from known ones', () => {
    expect(parseCasings('camelCase|kebabCase')).toEqual({ known: ['camelCase'], unknown: ['kebabCase'] });
  });

  it('reports a wholly unknown value as having no known name', () => {
    expect(parseCasings('camelcase')).toEqual({ known: [], unknown: ['camelcase'] });
  });

  it('ignores surrounding whitespace and empty segments', () => {
    expect(parseCasings(' camelCase | PascalCase ')).toEqual({ known: ['camelCase', 'PascalCase'], unknown: [] });
    expect(parseCasings('camelCase||')).toEqual({ known: ['camelCase'], unknown: [] });
  });
});

describe('decodeSegment', () => {
  it('unwraps every route-syntax shape SvelteKit gives a whole segment', () => {
    expect(decodeSegment('[hallId]')).toBe('hallId');
    expect(decodeSegment('[hallId=integer]')).toBe('hallId');
    expect(decodeSegment('[...rest]')).toBe('rest');
    expect(decodeSegment('[[optional]]')).toBe('optional');
    expect(decodeSegment('[[lang=locale]]')).toBe('lang');
    expect(decodeSegment('(app)')).toBe('app');
  });

  it('leaves a plain name alone', () => {
    expect(decodeSegment('hallList')).toBe('hallList');
    expect(decodeSegment('recommend-halls')).toBe('recommend-halls');
  });

  it('skips a compound segment, where no single identifier is named', () => {
    expect(decodeSegment('[foo]-[bar]')).toBeUndefined();
    expect(decodeSegment('x[y]z')).toBeUndefined();
    expect(decodeSegment('[]')).toBeUndefined();
    expect(decodeSegment('()')).toBeUndefined();
  });
});

describe('satisfiesCasing', () => {
  it('accepts a name matching any one of the allowed casings', () => {
    expect(satisfiesCasing('SeoContents', ['camelCase', 'PascalCase'])).toBe(true);
    expect(satisfiesCasing('fairSearch', ['camelCase', 'PascalCase'])).toBe(true);
  });

  it('rejects a name matching none of them', () => {
    expect(satisfiesCasing('recommend-halls', ['camelCase', 'PascalCase'])).toBe(false);
  });

  it('accepts a name with no letter in it, whatever is allowed', () => {
    // '2024' carries no casing, so no casing claim can be made about it. A year-archive route
    // cannot be renamed without changing its URL, so reporting it would not be actionable.
    expect(satisfiesCasing('2024', ['camelCase', 'PascalCase'])).toBe(true);
    expect(satisfiesCasing('404', ['PascalCase'])).toBe(true);
  });

  it('still judges a name that mixes digits and letters', () => {
    expect(satisfiesCasing('2024archive', ['camelCase'])).toBe(false);
    expect(satisfiesCasing('v2', ['camelCase'])).toBe(true);
  });

  it('rejects a name carrying a character none of the four admits', () => {
    expect(satisfiesCasing('foo.bar', ['camelCase', 'PascalCase', 'kebab-case', 'snake_case'])).toBe(false);
  });
});
