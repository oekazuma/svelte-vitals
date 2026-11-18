import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (markup: string) => parseComponentFacts(markup, 'src/lib/C.svelte');
const bullets = (markup: string) => facts(markup).bulletTexts!.map((b) => b.char);
const dts = (markup: string) => facts(markup).duplicateDts!.map((d) => d.text);

describe('plain-text bullets', () => {
  it('reports a bullet sequence at the top level once per text, sibling items and nested lines alike', () => {
    expect(bullets('- one<br />- two')).toEqual(['-', '-']);
    expect(bullets('<p>\n  • a<br />- b\n</p>\n<p>* c</p>')).toEqual(['•', '-', '*']);
    expect(bullets('<p>\n  <!-- note -->\n  • a\n</p>\n<p>\n  <!-- note -->\n  • b\n</p>')).toEqual(['•', '•']);
  });

  it('ignores bullets in list items, verbatim text, snippets and after a leading element, and does not group them across component bodies', () => {
    expect(bullets('<ul><li>- a<br />- b</li></ul>')).toEqual([]);
    expect(bullets('<ul><li>• a</li><li>• b</li></ul>')).toEqual([]);
    expect(bullets('<ul><li><span>• a</span><span>• b</span></li></ul>')).toEqual([]);
    expect(bullets('<pre>- a<br />- b</pre>')).toEqual([]);
    expect(bullets('<Item>• a</Item><Item>• b</Item>')).toEqual([]);
    expect(bullets('{#snippet s()}• a<br />• b{/snippet}')).toEqual([]);
    expect(bullets('<p><span></span>• a</p><p><span></span>• b</p>')).toEqual([]);
  });

  it('reads text after an interpolation as a sentence tail, across a comment', () => {
    expect(bullets('{n}<!-- c -->- a<br />- b')).toEqual([]);
  });
});

describe('duplicate <dt> names', () => {
  it('judges a <dl> in HTML again inside foreignObject, and not elsewhere in SVG', () => {
    expect(dts('<svg><foreignObject><dl><dt>a</dt><dt>a</dt></dl></foreignObject></svg>')).toEqual(['a']);
    expect(dts('<svg><g><dl><dt>a</dt><dt>a</dt></dl></g></svg>')).toEqual([]);
  });

  it('compares trimmed, whitespace-collapsed names of the direct <dt> children of an HTML <dl>', () => {
    expect(dts('<dl><dt> a</dt><dt>a</dt><dt>x y</dt><dt>x  y</dt><dt>xy</dt></dl>')).toEqual(['a', 'x y']);
    expect(dts('<Dl><dt>a</dt><dt>a</dt></Dl><div><dt>a</dt><dt>a</dt></div>')).toEqual([]);
    expect(
      dts(
        '<dl><Dt>a</Dt><Dt>a</Dt><section><dt>b</dt><dt>b</dt></section><div>\n<dt>c</dt><dd>c</dd>\n<Dt>c</Dt></div></dl>'
      )
    ).toEqual([]);
  });
});
