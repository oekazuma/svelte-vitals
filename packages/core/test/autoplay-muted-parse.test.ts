import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (src: string) => parseComponentFacts(src, 'A.svelte').videosAutoplayNoMuted;

describe('videosAutoplayNoMuted — records', () => {
  it('records a bare autoplay video without muted', () => {
    expect(facts('<video autoplay src="/a.mp4"></video>')).toEqual([{ line: 1 }]);
  });

  it('records autoplay with any literal value — presence is what autoplays', () => {
    expect(facts('<video autoplay="false" src="/a.mp4"></video>')).toEqual([{ line: 1 }]);
    expect(facts('<video autoplay="" src="/a.mp4"></video>')).toEqual([{ line: 1 }]);
  });

  it('records each offending video with its own line', () => {
    const src = [
      '<video autoplay src="/a.mp4"></video>',
      '<div>',
      '  <video autoplay src="/b.mp4"></video>',
      '</div>'
    ].join('\n');
    expect(facts(src)).toEqual([{ line: 1 }, { line: 3 }]);
  });
});

describe('videosAutoplayNoMuted — exclusions', () => {
  it('does not record a muted autoplay video', () => {
    expect(facts('<video autoplay muted src="/a.mp4"></video>')).toEqual([]);
  });

  it('does not record muted as an expression — it could be true', () => {
    expect(facts('<video autoplay muted={m} src="/a.mp4"></video>')).toEqual([]);
  });

  it('does not record bind:muted', () => {
    expect(facts('<video autoplay bind:muted={m} src="/a.mp4"></video>')).toEqual([]);
  });

  it('does not record an expression-valued autoplay — unknowable', () => {
    expect(facts('<video autoplay={a} src="/a.mp4"></video>')).toEqual([]);
  });

  it('does not record a spread — muted could arrive through it', () => {
    expect(facts('<video autoplay {...rest} src="/a.mp4"></video>')).toEqual([]);
  });

  it('does not record a video without autoplay', () => {
    expect(facts('<video src="/a.mp4" controls></video>')).toEqual([]);
  });

  it('does not record a dynamic-tag svelte:element', () => {
    expect(facts('<svelte:element this="video" autoplay src="/a.mp4"></svelte:element>')).toEqual([]);
  });
});
