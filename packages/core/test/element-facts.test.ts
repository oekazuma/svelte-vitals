import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (markup: string) => parseComponentFacts(markup, 'src/lib/C.svelte');

describe('ARIA elements', () => {
  it('reads input facts only from <input>, attribute lines from the attribute, and skips components', () => {
    const src =
      '<div type="x" list="l" role="button"></div>\n<div\n  aria-label="x"></div>\n<Foo role="button" aria-label="x" />';
    expect(
      facts(src).ariaElements!.map((e) => ({
        tag: e.tag,
        line: e.line,
        inputType: e.inputType,
        hasList: e.hasList,
        ariaLines: e.aria.map((a) => a.line)
      }))
    ).toEqual([
      { tag: 'div', line: 1, ariaLines: [] },
      { tag: 'div', line: 2, ariaLines: [3] }
    ]);
  });

  it('gives direct children of a dnd zone an action, and not children past a component or special element', () => {
    const src = [
      '<div use:dndzone={{ items }} class="z">',
      '  <div role="listitem" aria-label="a"></div>',
      '  <Item><div role="listitem" aria-label="b"></div></Item>',
      '  <svelte:self><div role="listitem" aria-label="c"></div></svelte:self>',
      '</div>'
    ].join('\n');
    expect(facts(src).ariaElements!.map((e) => [e.line, e.hasAction ?? false])).toEqual([
      [2, true],
      [3, false],
      [4, false]
    ]);
  });
});

describe('element chain', () => {
  const chain = (markup: string) =>
    facts(markup).elements!.map((e) => ({
      tag: e.tag,
      parent: e.parent,
      viaBlock: e.viaBlock,
      unknownContent: e.unknownContent
    }));

  it('breaks the chain at an unknown tag and a component, but silently at a snippet', () => {
    expect(chain('<ul><foo><li></li></foo></ul>')).toEqual([
      { tag: 'ul', unknownContent: true },
      { tag: 'foo', parent: 0 },
      { tag: 'li' }
    ]);
    expect(chain('<ul>{#snippet s()}<li></li>{/snippet}</ul><ol><Foo /></ol>')).toEqual([
      { tag: 'ul' },
      { tag: 'li' },
      { tag: 'ol', unknownContent: true }
    ]);
  });

  it('records only regular elements', () => {
    expect(chain('<svelte:window onkeydown={f} />\n<svelte:head><title>T</title></svelte:head>')).toEqual([]);
  });

  it('marks only an element below a parent as reached through a block, and gives attributes their own line', () => {
    const els = facts('{#if x}<div></div>{/if}\n<p\n  title="t"></p>').elements!;
    expect(els.map((e) => [e.tag, e.viaBlock, e.attrs.map((a) => a.line)])).toEqual([
      ['div', undefined, []],
      ['p', undefined, [3]]
    ]);
  });
});

describe('interactive nesting', () => {
  it('carries the role only of a non-native container, and walks snippets with a fresh stack', () => {
    const src = [
      '<button role="tab"><a href="/x">x</a></button>',
      '<a href="/y" role="button"><button>y</button></a>',
      '<Foo role="button"><a href="/z">z</a></Foo>',
      '{#snippet s()}<button><a href="/w">w</a></button>{/snippet}'
    ].join('\n');
    expect(facts(src).interactiveNestings).toEqual([
      { containerTag: 'button', descendantTag: 'a', line: 1 },
      { containerTag: 'a', descendantTag: 'button', line: 2 },
      { containerTag: 'button', descendantTag: 'a', line: 4 }
    ]);
  });
});

describe('focusable elements under aria-hidden', () => {
  it('reports by attribute name only, pops the container after it, and skips components', () => {
    const src = [
      '<div title="true"><button>a</button></div>',
      '<button title="-1" aria-hidden="true">b</button>',
      '<div aria-hidden="true"><button aria-hidden="true">c</button></div>',
      '<div aria-hidden="true"></div><button>d</button>',
      '<Foo aria-hidden="true"><button>e</button></Foo>',
      '<div aria-hidden="true" class:inert={x}><button>f</button></div>',
      '{#snippet s()}<div aria-hidden="true"><button>g</button></div>{/snippet}'
    ].join('\n');
    expect(facts(src).ariaHiddenFocusables).toEqual([
      { tag: 'button', line: 2 },
      { tag: 'button', line: 3 },
      { tag: 'button', containerTag: 'div', line: 6 },
      { tag: 'button', containerTag: 'div', line: 7 }
    ]);
  });
});
