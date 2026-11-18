import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (markup: string) => parseComponentFacts(markup, 'src/lib/C.svelte');

describe('<time> without datetime', () => {
  const times = (markup: string) => facts(markup).timesMissingDatetime.map((t) => t.text);

  it('reports trimmed human-readable text of a plain <time> only', () => {
    expect(times('<time class="d"> Jan 1 </time>\n<span>Jan 2</span>\n<Time>Jan 3</Time>')).toEqual(['Jan 1']);
  });

  it('skips machine-readable, blank, mixed or spread <time> content', () => {
    expect(
      times('<time> 2024-01-01 </time>\n<time>  </time>\n<time>Jan {d}</time>\n<time {...rest}>Jan 4</time>')
    ).toEqual([]);
  });
});

describe('required <select> without a placeholder', () => {
  const selects = (markup: string) => facts(markup).selectsMissingPlaceholder.map((s) => s.line);

  it('reports an empty one and one whose first option has a label', () => {
    expect(
      selects(
        [
          '<select required></select>',
          '<select required>\n  <!-- c -->\n  <option>Pick</option>\n</select>',
          '<select required size="1"><option value="a">A</option></select>'
        ].join('\n')
      )
    ).toEqual([1, 2, 6]);
  });

  it('skips one that needs no placeholder, starts with something else, or starts with a placeholder', () => {
    expect(
      selects(
        [
          '<input required />',
          '<Select required />',
          '<select required={req}><option>A</option></select>',
          '<select required size={n}><option>A</option></select>',
          '<select required><div>Choose</div><option>A</option></select>',
          '<select required>Choose<option>A</option></select>',
          '<select required><option value="a" {...o}>A</option></select>',
          '<select required><option value={v}>A</option></select>',
          '<select required><option></option></select>'
        ].join('\n')
      )
    ).toEqual([]);
  });
});

describe('duplicate <dt> text through markup', () => {
  const dts = (markup: string) => facts(markup).duplicateDts.map((d) => d.text);

  it('gives up on a <dt> holding a component or an interpolation', () => {
    expect(dts('<dl><dt><Foo>a</Foo></dt><dt><Foo>a</Foo></dt><dt><b>{x}</b></dt><dt><b>{x}</b></dt></dl>')).toEqual([]);
  });
});

describe('autoplaying <video> without muted', () => {
  const videos = (markup: string) => facts(markup).videosAutoplayNoMuted.map((v) => v.line);

  it('reports an HTML <video> only, and takes bind:muted as muted', () => {
    expect(
      videos(
        [
          '<video autoplay bind:paused={p}></video>',
          '<video autoplay class:muted={m}></video>',
          '<video autoplay bind:muted={m}></video>',
          '<Video autoplay />',
          '<audio autoplay></audio>',
          '<svg><g><video autoplay></video></g></svg>'
        ].join('\n')
      )
    ).toEqual([1, 2]);
  });
});

describe('<label> without a control', () => {
  const labels = (markup: string) => facts(markup).unassociatedLabels.map((l) => l.line);

  it('reports a plain <label> only', () => {
    expect(labels('<label class="x">Name</label>\n<span>Name</span>\n<Label>Name</Label>\n<label {...a}>Name</label>')).toEqual([
      1
    ]);
  });
});
