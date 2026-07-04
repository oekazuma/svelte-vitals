import { describe, it, expect } from 'vitest';
import {
  valueFromNodes,
  textFromNodes,
  attrText,
  attrValue,
  lineOf,
  findAttr,
  attrValueOf,
  attrTextOf
} from '../src/svelte-ast.js';

describe('valueFromNodes', () => {
  it('is dynamic when any node is an ExpressionTag', () => {
    expect(valueFromNodes([{ type: 'ExpressionTag' }])).toBe('dynamic');
  });
  it('is static when there is non-whitespace text', () => {
    expect(valueFromNodes([{ type: 'Text', data: 'hello' }])).toBe('static');
  });
  it('is absent when empty or whitespace-only', () => {
    expect(valueFromNodes([])).toBe('absent');
    expect(valueFromNodes([{ type: 'Text', data: '   ' }])).toBe('absent');
  });
  it('is absent for a non-array', () => {
    expect(valueFromNodes(undefined as unknown as never[])).toBe('absent');
  });
});

describe('textFromNodes', () => {
  it('returns the literal text when fully static', () => {
    expect(textFromNodes([{ type: 'Text', data: 'hello' }])).toBe('hello');
  });
  it('returns undefined when any node is an ExpressionTag', () => {
    expect(textFromNodes([{ type: 'ExpressionTag' }])).toBeUndefined();
  });
  it('returns undefined for whitespace-only text', () => {
    expect(textFromNodes([{ type: 'Text', data: '  ' }])).toBeUndefined();
  });
});

describe('findAttr', () => {
  it('finds an attribute by name', () => {
    const attrs = [{ type: 'Attribute', name: 'href', value: true }];
    expect(findAttr(attrs, 'href')).toBe(attrs[0]);
  });
  it('returns undefined when absent', () => {
    expect(findAttr([{ type: 'Attribute', name: 'href', value: true }], 'src')).toBeUndefined();
  });
  it('returns undefined for a non-array', () => {
    expect(findAttr(undefined as unknown as never[], 'href')).toBeUndefined();
  });
});

describe('attrText', () => {
  it('returns the literal string of a static attribute', () => {
    const attrs = [{ type: 'Attribute', name: 'name', value: [{ type: 'Text', data: 'description' }] }];
    expect(attrText(attrs, 'name')).toBe('description');
  });
  it('returns empty string for a boolean attribute', () => {
    const attrs = [{ type: 'Attribute', name: 'disabled', value: true }];
    expect(attrText(attrs, 'disabled')).toBe('');
  });
  it('returns undefined for a dynamic attribute', () => {
    const attrs = [{ type: 'Attribute', name: 'name', value: { type: 'ExpressionTag' } }];
    expect(attrText(attrs, 'name')).toBeUndefined();
  });
  it('returns undefined when the attribute is absent', () => {
    expect(attrText([], 'name')).toBeUndefined();
  });
});

describe('attrValue', () => {
  it('is dynamic for content={expr}', () => {
    const attrs = [{ type: 'Attribute', name: 'content', value: { type: 'ExpressionTag' } }];
    expect(attrValue(attrs, 'content')).toBe('dynamic');
  });
  it('is static for a literal content', () => {
    const attrs = [{ type: 'Attribute', name: 'content', value: [{ type: 'Text', data: 'hi' }] }];
    expect(attrValue(attrs, 'content')).toBe('static');
  });
  it('is absent when the attribute is missing or boolean', () => {
    expect(attrValue([], 'content')).toBe('absent');
    expect(attrValue([{ type: 'Attribute', name: 'content', value: true }], 'content')).toBe('absent');
  });
});

describe('attrValueOf / attrTextOf', () => {
  it('attrValueOf mirrors attrValue for a single attribute node', () => {
    expect(attrValueOf({ value: { type: 'ExpressionTag' } })).toBe('dynamic');
    expect(attrValueOf({ value: [{ type: 'Text', data: 'hi' }] })).toBe('static');
    expect(attrValueOf({ value: true })).toBe('absent');
  });
  it('attrTextOf returns the literal text or undefined if dynamic/absent', () => {
    expect(attrTextOf({ value: [{ type: 'Text', data: 'hi' }] })).toBe('hi');
    expect(attrTextOf({ value: [{ type: 'ExpressionTag' }] })).toBeUndefined();
    expect(attrTextOf({ value: true })).toBeUndefined();
  });
});

describe('lineOf', () => {
  it('computes the 1-based line for an offset', () => {
    expect(lineOf('a\nb\nc', 2)).toBe(2);
    expect(lineOf('a\nb\nc', 4)).toBe(3);
  });
  it('returns 0 for an unknown/invalid offset', () => {
    expect(lineOf('abc', undefined)).toBe(0);
    expect(lineOf('abc', -1)).toBe(0);
  });
});
