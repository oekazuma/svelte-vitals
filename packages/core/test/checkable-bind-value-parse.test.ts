import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const cbv = (src: string) => parseComponentFacts(src, 'A.svelte').checkableBindValues;

describe('checkableBindValues — records', () => {
  it('records a checkbox with bind:value', () => {
    const src = ['<script>', "  let x = $state(false);", '</script>', '<input type="checkbox" bind:value={x} />'].join(
      '\n'
    );
    expect(cbv(src)).toEqual([{ kind: 'checkbox', line: 4 }]);
  });

  it('records a radio with bind:value', () => {
    const src = ['<script>', "  let x = $state('a');", '</script>', '<input type="radio" bind:value={x} />'].join(
      '\n'
    );
    expect(cbv(src)).toEqual([{ kind: 'radio', line: 4 }]);
  });

  it('records each of multiple checkable inputs with its own line', () => {
    const src = [
      '<script>',
      '  let x = $state(false);',
      "  let y = $state('a');",
      '</script>',
      '<input type="checkbox" bind:value={x} />',
      '<input type="radio" bind:value={y} />'
    ].join('\n');
    expect(cbv(src)).toEqual([
      { kind: 'checkbox', line: 5 },
      { kind: 'radio', line: 6 }
    ]);
  });
});

describe('checkableBindValues — exclusions', () => {
  it('does not record bind:checked on a checkbox', () => {
    expect(cbv('<input type="checkbox" bind:checked={x} />')).toEqual([]);
  });

  it('does not record bind:group on a radio (correct pattern)', () => {
    expect(cbv('<input type="radio" bind:group={x} value="a" />')).toEqual([]);
  });

  it('does not record a plain value attribute paired with bind:group', () => {
    expect(cbv('<input type="checkbox" value="a" bind:group={x} />')).toEqual([]);
  });

  it('does not record bind:value on a non-checkable input type', () => {
    expect(cbv('<input type="text" bind:value={x} />')).toEqual([]);
  });

  it('does not record bind:value with a dynamic type', () => {
    const src = [
      '<script>',
      "  let t = 'checkbox';",
      '  let x = $state(false);',
      '</script>',
      '<input type={t} bind:value={x} />'
    ].join('\n');
    expect(cbv(src)).toEqual([]);
  });

  it('does not record bind:value on a dynamic-tag svelte:element', () => {
    expect(cbv('<svelte:element this="input" type="checkbox" bind:value={x} />')).toEqual([]);
  });

  it('does not record bind:value on a select', () => {
    expect(cbv('<select bind:value={x}><option value="a">a</option></select>')).toEqual([]);
  });
});
