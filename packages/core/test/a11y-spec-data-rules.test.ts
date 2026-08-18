import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';
import { a11yDeprecatedElement, a11yDeprecatedAttr } from '../src/internal.js';
import { defineConfig, defaultProject, type Result } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const ctx = (src: string): RuleContext => ({
  heads: [],
  project: defaultProject,
  config,
  components: [{ ...parseComponentFacts(src, 'src/lib/C.svelte'), file: 'src/lib/C.svelte' }]
});
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none').map((r) => `${r.line}:${r.message}`);

describe('parseComponentFacts — elements (HTML spec-data rules)', () => {
  it('records every element with its attribute names lowercased (a capitalized tag is a component)', () => {
    const c = parseComponentFacts('<div Class="x" {...rest} on:click={f}><span id="a" /></div>', 'C.svelte');
    expect(c.elements).toEqual([
      { tag: 'div', line: 1, attrs: [{ name: 'class', line: 1 }] },
      { tag: 'span', line: 1, attrs: [{ name: 'id', line: 1 }] }
    ]);
  });

  it('flags the SVG subtree, and returns to HTML under <foreignObject>', () => {
    const c = parseComponentFacts(
      '<svg><style></style><foreignObject><b></b></foreignObject></svg><i></i>',
      'C.svelte'
    );
    expect(c.elements!.map((e) => [e.tag, e.inSvg ?? false])).toEqual([
      ['svg', true],
      ['style', true],
      ['foreignobject', true],
      ['b', false],
      ['i', false]
    ]);
  });

  it('starts inside SVG for a component declaring the svg namespace', () => {
    const c = parseComponentFacts('<svelte:options namespace="svg" /><g><style></style></g>', 'C.svelte');
    expect(c.elements!.every((e) => e.inSvg)).toBe(true);
  });
});

describe('a11y/deprecated-element', () => {
  it('reports obsolete elements and not their replacements', async () => {
    const out = await a11yDeprecatedElement.check(ctx('<strike>a</strike>\n<s>b</s>\n<center>c</center>'));
    expect(fails(out)).toEqual(['1:<strike> is an obsolete element', '3:<center> is an obsolete element']);
  });

  it('leaves marquee and blink to the compiler', async () => {
    const out = await a11yDeprecatedElement.check(ctx('<marquee>m</marquee><blink>b</blink>'));
    expect(fails(out)).toEqual([]);
  });

  it('skips the SVG namespace, and returns for <foreignObject> content', async () => {
    const out = await a11yDeprecatedElement.check(
      ctx('<svg><font>x</font><foreignObject><font>y</font></foreignObject></svg>')
    );
    expect(fails(out)).toEqual(['1:<font> is an obsolete element']);
  });
});

describe('a11y/deprecated-attr', () => {
  it('reports an attribute deprecated on this element and not the same name on another', async () => {
    const out = await a11yDeprecatedAttr.check(
      ctx('<table><tr><td width="1">a</td></tr></table>\n<img src="x" width="1" alt="" />')
    );
    expect(fails(out)).toEqual(['1:`width` on <td> is a deprecated attribute']);
  });

  it('yields one finding per element, anchored at the start tag so a directive can reach it', async () => {
    const out = await a11yDeprecatedAttr.check(
      ctx('<table\n  border="0"\n  cellpadding="0"\n  width="100%"\n><tr><td>x</td></tr></table>')
    );
    expect(fails(out)).toEqual(['1:`border`, `cellpadding`, `width` on <table> are deprecated attributes']);
  });

  it('reports the head <style type>, which is an element, and cannot see the component stylesheet', async () => {
    const out = await a11yDeprecatedAttr.check(
      ctx('<svelte:head><style type="text/css"></style></svelte:head>\n<style type="text/css"></style>')
    );
    expect(fails(out)).toEqual(['1:`type` on <style> is a deprecated attribute']);
  });

  it('is silent for <style type> inside <svg>', async () => {
    const out = await a11yDeprecatedAttr.check(ctx('<svg><style type="text/css"></style></svg>'));
    expect(fails(out)).toEqual([]);
  });

  it('counts an attribute that is both deprecated and nonStandard', async () => {
    const out = await a11yDeprecatedAttr.check(ctx('<hr size="2" />'));
    expect(fails(out)).toEqual(['1:`size` on <hr> is a deprecated attribute']);
  });

  it('yields no second finding for an attribute on an obsolete element', async () => {
    const out = await a11yDeprecatedAttr.check(ctx('<font color="red">x</font><marquee behavior="scroll">m</marquee>'));
    expect(fails(out)).toEqual([]);
  });

  it('does not consult the global attribute groups', async () => {
    const out = await a11yDeprecatedAttr.check(ctx('<svg><use xlink:href="#i" /></svg><div xml:lang="en">t</div>'));
    expect(fails(out)).toEqual([]);
  });
});
