import { describe, it, expect } from 'vitest';
import { a11yPermittedContents } from '../src/internal.js';
import { parseComponentFacts } from '../src/component-parse.js';
import { defineConfig, defaultProject, type Result, type Severity } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const ctx = (src: string): RuleContext => ({
  heads: [],
  project: defaultProject,
  config,
  components: [{ file: 'src/lib/C.svelte', ...parseComponentFacts(src, 'src/lib/C.svelte') }]
});
const run = (src: string) => a11yPermittedContents.check(ctx(src));
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const failing = async (src: string): Promise<{ line?: number; severity: Severity; message: string }[]> =>
  fails(await run(src)).map((r) => ({ line: r.line, severity: r.severity, message: r.message }));

describe('a11y/permitted-contents', () => {
  it('flags a non-li child of <ul> as warning, and a branch child too', async () => {
    const out = await failing('<ul>\n  <div>x</div>\n  <li>ok</li>\n  {#if c}<span>y</span>{/if}\n</ul>');
    expect(out).toEqual([
      {
        line: 2,
        severity: 'warning',
        message: '`<div>` is not permitted content here — `<ul>` admits only `<li>` and script-supporting elements'
      },
      {
        line: 4,
        severity: 'warning',
        message: '`<span>` is not permitted content here — `<ul>` admits only `<li>` and script-supporting elements'
      }
    ]);
  });

  it('flags flow inside a phrasing container as info', async () => {
    const out = await failing('<button><div>x</div></button>\n<span><div>y</div></span>');
    expect(out.map((f) => f.severity)).toEqual(['info', 'info']);
  });

  it('escalates a heading child, and a structure-bound child, to warning', async () => {
    const out = await failing('<button><h5>t</h5></button>\n<div><li>item</li></div>');
    expect(out.map((f) => [f.line, f.severity])).toEqual([
      [1, 'warning'],
      [2, 'warning']
    ]);
  });

  it('accepts the dl > div wrapper; a div with a known non-dl parent rejects dt', async () => {
    expect(await failing('<dl>\n  <div><dt>t</dt><dd>d</dd></div>\n</dl>')).toEqual([]);
    // At template root the dl > div conditional is undecidable — laxest union, silent.
    expect(await failing('<div><dt>t</dt></div>')).toEqual([]);
    const out = await failing('<section><div><dt>t</dt></div></section>');
    expect(out.map((f) => [f.line, f.severity])).toEqual([[1, 'warning']]);
  });

  it('judges a transparent <a> chain against the enclosing model, as warning', async () => {
    const out = await failing('<ul>\n  <a href="/x"><strong>t</strong></a>\n</ul>');
    // <a> itself fails ul's membership; <strong> fails through the transparent chain.
    expect(out.map((f) => [f.line, f.severity])).toEqual([
      [2, 'warning'],
      [2, 'warning']
    ]);
    expect(out[1]!.message).toContain('`<ul>`');
  });

  it('leaves interactive nesting to a11y/interactive-nesting', async () => {
    expect(await failing('<a href="/x"><button>b</button></a>\n<button><a href="/y">l</a></button>')).toEqual([]);
  });

  it('still evaluates non-interactive exclusion arms (form > form)', async () => {
    const out = await failing('<form>{#if c}<form></form>{/if}</form>');
    expect(out.map((f) => f.severity)).toEqual(['info']);
  });

  it('sides with the compiler on <option> rich content', async () => {
    expect(await failing('<select><option><b>rich</b></option></select>')).toEqual([]);
  });

  it('never judges across a component, snippet, slot, svelte:element, or {@render} boundary', async () => {
    const src = [
      '<ul><Card><div>not judged</div></Card></ul>',
      '{#snippet row()}<td>not judged against outer</td>{/snippet}',
      '<ul><slot /></ul>',
      '<ul><svelte:element this={tag}>x</svelte:element></ul>',
      '<ul>{@render row()}</ul>'
    ].join('\n');
    expect(await failing(src)).toEqual([]);
  });

  it('judges nesting inside a snippet body on its own', async () => {
    const out = await failing('{#snippet block()}<ul><div>x</div></ul>{/snippet}');
    expect(out.map((f) => f.severity)).toEqual(['warning']);
  });

  it('skips custom elements and SVG subtrees', async () => {
    expect(
      await failing('<my-widget><li>x</li></my-widget>\n<ul><my-item>y</my-item></ul>\n<svg><foo>z</foo></svg>')
    ).toEqual([]);
  });

  it('keeps judging literal children next to an unknowable sibling', async () => {
    const out = await failing('<ul>\n  <Component />\n  <div>x</div>\n</ul>');
    expect(out.map((f) => f.line)).toEqual([3]);
  });

  it('honours positive :has — hgroup with a heading is valid summary content', async () => {
    expect(await failing('<details><summary><hgroup><h2>t</h2></hgroup></summary></details>')).toEqual([]);
    expect(await failing('<figure><figcaption>c</figcaption></figure>\n<hgroup><h1>t</h1><p>s</p></hgroup>')).toEqual(
      []
    );
  });

  it('is silenced by an inline directive on the finding line', async () => {
    const src = '<ul>\n  <!-- svelte-vitals-disable-next-line a11y/permitted-contents -->\n  <div>x</div>\n</ul>';
    expect(await failing(src)).toEqual([]);
  });

  it('emits one PASS for a clean file that has elements', async () => {
    const rs = await run('<ul><li>ok</li></ul>');
    expect(fails(rs)).toEqual([]);
    expect(rs).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
  });
});
