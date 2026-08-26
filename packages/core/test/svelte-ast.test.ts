import { describe, it, expect } from 'vitest';
import type { AST } from 'svelte/compiler';
import {
  parseSvelte,
  valueFromNodes,
  textFromNodes,
  attrText,
  attrValue,
  lineOf,
  findAttr,
  attrValueOf,
  attrTextOf
} from '../src/svelte-ast.js';

/** Test-only builders: fill in the position/expression fields real AST nodes carry but this module never reads. */
function text(data: string): AST.Text {
  return { type: 'Text', data, raw: data, start: 0, end: 0 };
}
function exprTag(): AST.ExpressionTag {
  return {
    type: 'ExpressionTag',
    expression: { type: 'Identifier', name: '_' } as AST.ExpressionTag['expression'],
    start: 0,
    end: 0
  };
}
function attr(name: string, value: AST.Attribute['value']): AST.Attribute {
  return { type: 'Attribute', name, name_loc: null, value, start: 0, end: 0 };
}

describe('valueFromNodes', () => {
  it('is dynamic when any node is an ExpressionTag', () => {
    expect(valueFromNodes([exprTag()])).toBe('dynamic');
  });
  it('is static when there is non-whitespace text', () => {
    expect(valueFromNodes([text('hello')])).toBe('static');
  });
  it('is absent when empty or whitespace-only', () => {
    expect(valueFromNodes([])).toBe('absent');
    expect(valueFromNodes([text('   ')])).toBe('absent');
  });
  it('is absent for a non-array', () => {
    const nodes: AST.Text[] | undefined = undefined;
    expect(valueFromNodes(nodes!)).toBe('absent');
  });
});

describe('textFromNodes', () => {
  it('returns the literal text when fully static', () => {
    expect(textFromNodes([text('hello')])).toBe('hello');
  });
  it('returns undefined when any node is an ExpressionTag', () => {
    expect(textFromNodes([exprTag()])).toBeUndefined();
  });
  it('returns undefined for whitespace-only text', () => {
    expect(textFromNodes([text('  ')])).toBeUndefined();
  });
});

describe('findAttr', () => {
  it('finds an attribute by name', () => {
    const attrs = [attr('href', true)];
    expect(findAttr(attrs, 'href')).toBe(attrs[0]);
  });
  it('returns undefined when absent', () => {
    expect(findAttr([attr('href', true)], 'src')).toBeUndefined();
  });
  it('returns undefined for a non-array', () => {
    const attrs: AST.Attribute[] | undefined = undefined;
    expect(findAttr(attrs!, 'href')).toBeUndefined();
  });
});

describe('attrText', () => {
  it('returns the literal string of a static attribute', () => {
    const attrs = [attr('name', [text('description')])];
    expect(attrText(attrs, 'name')).toBe('description');
  });
  it('returns empty string for a boolean attribute', () => {
    const attrs = [attr('disabled', true)];
    expect(attrText(attrs, 'disabled')).toBe('');
  });
  it('returns undefined for a dynamic attribute', () => {
    const attrs = [attr('name', exprTag())];
    expect(attrText(attrs, 'name')).toBeUndefined();
  });
  it('returns undefined for a mixed static/dynamic attribute (e.g. href="prefix{expr}")', () => {
    const attrs = [attr('href', [text('prefix'), exprTag()])];
    expect(attrText(attrs, 'href')).toBeUndefined();
  });
  it('returns undefined when the attribute is absent', () => {
    expect(attrText([], 'name')).toBeUndefined();
  });
});

describe('attrValue', () => {
  it('is dynamic for content={expr}', () => {
    const attrs = [attr('content', exprTag())];
    expect(attrValue(attrs, 'content')).toBe('dynamic');
  });
  it('is static for a literal content', () => {
    const attrs = [attr('content', [text('hi')])];
    expect(attrValue(attrs, 'content')).toBe('static');
  });
  it('is absent when the attribute is missing or boolean', () => {
    expect(attrValue([], 'content')).toBe('absent');
    expect(attrValue([attr('content', true)], 'content')).toBe('absent');
  });
});

describe('attrValueOf / attrTextOf', () => {
  it('attrValueOf mirrors attrValue for a single attribute node', () => {
    expect(attrValueOf(attr('x', exprTag()))).toBe('dynamic');
    expect(attrValueOf(attr('x', [text('hi')]))).toBe('static');
    expect(attrValueOf(attr('x', true))).toBe('absent');
  });
  it('attrTextOf returns the literal text or undefined if dynamic/absent', () => {
    expect(attrTextOf(attr('x', [text('hi')]))).toBe('hi');
    expect(attrTextOf(attr('x', [exprTag()]))).toBeUndefined();
    expect(attrTextOf(attr('x', true))).toBeUndefined();
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

describe('parseSvelte', () => {
  // Svelte parses a <style> body as CSS whatever its `lang` says, so a preprocessor dialect made the
  // whole file unparseable — and one unparseable route file fails the entire run.
  const scss = `<h1 id="t">Hi</h1>\n<style lang="scss">\n  .a { color: red; // note\n    .b { color: blue; }\n  }\n</style>`;

  it('parses a component whose style block is in a CSS dialect', () => {
    const ast = parseSvelte(scss, 'src/routes/+page.svelte');
    expect(ast.fragment.nodes.some((n) => n.type === 'RegularElement' && n.name === 'h1')).toBe(true);
  });

  it('leaves every offset where it was, so reported lines stay correct', () => {
    const trailing = `${scss}\n<p>after</p>`;
    const ast = parseSvelte(trailing, 'src/routes/+page.svelte');
    const p = ast.fragment.nodes.find((n) => n.type === 'RegularElement' && n.name === 'p');
    expect(lineOf(trailing, p!.start)).toBe(7);
  });

  it('still throws on a genuinely malformed component', () => {
    expect(() => parseSvelte('<div>{#if x}</div>', 'src/routes/+page.svelte')).toThrow();
  });

  it('leaves a source that already parses untouched, style-like text and all', () => {
    // The blanking scan is text, not parse, so it could match inside a string or an attribute.
    // It never runs on these: they parse on the first attempt.
    const embedded = `<script>const s = '<style lang="scss">.a { color: red; }</style>';</script><p>x</p>`;
    expect(() => parseSvelte(embedded, 'src/routes/+page.svelte')).not.toThrow();

    const dataLang = `<p>x</p><style data-lang="scss">.a { color: red; }</style>`;
    const ast = parseSvelte(dataLang, 'src/routes/+page.svelte');
    expect(ast.css?.children.length).toBe(1);
  });
});
