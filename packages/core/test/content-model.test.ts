import { describe, it, expect } from 'vitest';
import { a11yPermittedContents } from '../src/internal.js';
import { parseComponentFacts } from '../src/component-parse.js';
import { defineConfig, defaultProject, type Result } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const ctx = (src: string): RuleContext => ({
  heads: [],
  project: defaultProject,
  config,
  components: [{ file: 'src/lib/C.svelte', ...parseComponentFacts(src, 'src/lib/C.svelte') }]
});
const isFinding = (r: Result) => r.detection.presence === 'none' || r.detection.value === 'absent';
const findings = async (src: string) =>
  (await a11yPermittedContents.check(ctx(src))).filter(isFinding).map((r) => `${r.line} ${r.severity} ${r.message}`);
const lines = async (src: string) =>
  (await a11yPermittedContents.check(ctx(src))).filter(isFinding).map((r) => r.line);

describe('content-model evaluation', () => {
  it('excludes by :not and :has arguments that nest parentheses', async () => {
    expect(await findings('<footer>\n  <div><header>x</header></div>\n</footer>')).toEqual([
      "2 info `<div>` is not permitted content here — `<footer>`'s content model is flow content"
    ]);
    expect(await lines('<address>\n  <header>x</header>\n  <h1>y</h1>\n</address>')).toEqual([2, 3]);
  });

  it('lets a transparent parent pass the child on to the next ancestor', async () => {
    expect(await lines('<span>\n  <a href="/x"><div>x</div></a>\n</span>')).toEqual([2]);
    expect(await lines('<p>\n  <ins><div>x</div></ins>\n  <ins><span>y</span></ins>\n</p>')).toEqual([2]);
  });

  it('matches link attributes by name and literal value, and stays silent when they are unknowable', async () => {
    const src = [
      '<p><link href="/x" /></p>',
      '<p><link rel="icon" /></p>',
      '<p><link rel="dns-prefetch" href="x" /></p>',
      '<p><link {...a} /></p>',
      '<p><link rel={r} /></p>'
    ].join('\n');
    expect(await lines(src)).toEqual([1, 2]);
  });

  it('applies the audio and video filter, from the base model and from the [src] conditional', async () => {
    const src = [
      '<p><video><video></video></video></p>',
      '<p><video src="x"><video></video></video></p>',
      '<p><video src="x"><span></span></video></p>',
      '<p><video><div><span></span></div></video></p>',
      '<p><video><div><span><Comp /></span></div></video></p>',
      '<p><video><div><Comp /></div></video></p>',
      '<p><video src="x"><div><Comp /></div></video></p>'
    ].join('\n');
    expect((await findings(src)).map((f) => f.split(' ').slice(0, 3).join(' '))).toEqual([
      '1 warning `<video>`',
      '2 warning `<video>`',
      '4 info `<div>`'
    ]);
  });

  it('describes closed, empty and category models', async () => {
    const src = [
      '<iframe><p>x</p></iframe>',
      '<table><colgroup><div></div></colgroup></table>',
      '<table><colgroup span="2"><col /></colgroup></table>',
      '<dl><div><p>x</p></div></dl>',
      '<select><div>x</div></select>',
      '<details><summary>s</summary><td>x</td></details>'
    ].join('\n');
    expect(await findings(src)).toEqual([
      '1 warning `<p>` is not permitted content here — `<iframe>` admits no element children',
      '2 warning `<div>` is not permitted content here — `<colgroup>` admits only `<col>`, `<template>`',
      '3 warning `<col>` is not permitted content here — `<colgroup>` admits no element children',
      '4 warning `<p>` is not permitted content here — `<div>` admits only `<dt>`, `<dd>` and script-supporting elements',
      '5 warning `<div>` is not permitted content here — `<select>` admits only `<option>`, `<optgroup>`, `<hr>` and script-supporting elements',
      "6 warning `<td>` is not permitted content here — `<details>`'s content model is flow content"
    ]);
  });

  it('admits optional entries and anything inside an element whose model is open', async () => {
    expect(await lines('<fieldset><legend>l</legend><input /></fieldset>\n<template><li>x</li></template>')).toEqual([]);
  });
});
