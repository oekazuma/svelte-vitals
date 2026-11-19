import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (markup: string) => parseComponentFacts(markup, 'src/lib/C.svelte');
const unnamed = (markup: string) => facts(markup).unnamedInteractive!.map((u) => `${u.tag}:${u.line}`);
const unassociated = (markup: string) => facts(markup).unassociatedLabels!.map((l) => l.line);

describe('interactive elements without a name', () => {
  it('reports a button, a link with href and an image input with no name', () => {
    expect(
      unnamed(
        [
          '<button> </button>',
          '<a href="/x"></a>',
          '<input type="image" src="x.png" />',
          '<input type="IMAGE" src="x.png" />',
          '<button><span alt="Go"></span></button>'
        ].join('\n')
      )
    ).toEqual(['button:1', 'a:2', 'input:3', 'input:4', 'button:5']);
  });

  it('skips other elements, named ones and ones whose name is unknowable', () => {
    expect(
      unnamed(
        [
          '<a></a>',
          '<div href="/x"></div>',
          '<div type="image"></div>',
          '<input type="text" />',
          '<input type="image" alt="Go" />',
          '<input type="image" aria-label="Go" />',
          '<button {...rest}></button>',
          '<button>{@render icon()}</button>',
          '<button>{@html svg}</button>'
        ].join('\n')
      )
    ).toEqual([]);
  });

  it('takes an image input as named by a wrapping or pointing label, and never a link', () => {
    expect(
      unnamed(
        [
          '<label>Go <input type="image" src="a.png" /></label>',
          '<label for=" ">Go</label><input id="" type="image" src="d.png" />',
          '<label for="lnk">Go</label><a id="lnk" href="/x"></a>',
          '<span for="s">Go</span><input id="s" type="image" src="e.png" />',
          '<Label for="c">Go</Label><input id="c" type="image" src="f.png" />',
          '<label>Go {#snippet s()}<input type="image" src="g.png" />{/snippet}</label>',
          '<label for="p">Go</label><input id="p" type="image" src="h.png" />'
        ].join('\n')
      )
    ).toEqual(['input:2', 'a:3', 'input:4', 'input:5', 'input:6']);
  });

  it("matches a label's for to an id exactly, surrounding spaces included", () => {
    expect(
      unnamed(
        [
          '<label for="a">Go</label><input id=" a " type="image" src="a.png" />',
          '<label for=" b ">Go</label><input id="b" type="image" src="b.png" />',
          '<label for=" c ">Go</label><input id=" c " type="image" src="c.png" />'
        ].join('\n')
      )
    ).toEqual(['input:1', 'input:2']);
  });
});

describe('labels without a control', () => {
  it('reports a label holding only text or a hidden input', () => {
    expect(unassociated('<label>Name <input type="hidden" /></label>\n<label>Name</label>')).toEqual([1, 2]);
  });

  it('skips a label whose content is unknowable', () => {
    expect(unassociated('<label>{x}</label>\n<label>{@render s()}</label>\n<label>{@html h}</label>')).toEqual([]);
  });
});
