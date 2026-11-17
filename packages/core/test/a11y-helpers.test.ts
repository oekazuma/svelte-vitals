import { describe, it, expect } from 'vitest';
import { decodeFragmentId, foldOccurrences, isTopFragment, splitTokens, stripTextDirective } from '../src/a11y.js';

describe('foldOccurrences — arm choice', () => {
  it('keeps the arm with the most occurrences, and the lowest branch on a tie', () => {
    const n = (id: string, branch: number) => ({ id, key: 'h1', path: [{ group: 0, branch }], repeatable: false });
    const folded = foldOccurrences([n('b1a', 1), n('b1b', 1), n('b2a', 2), n('b2b', 2), n('b0a', 0)]);
    expect(folded.get('h1')!.map((o) => o.id)).toEqual(['b1a', 'b1b']);
  });
});

describe('fragment and token helpers', () => {
  it('splits a value into its non-empty whitespace-separated tokens', () => {
    expect([splitTokens('  a  b '), splitTokens('   '), splitTokens(''), splitTokens(undefined)]).toEqual([
      ['a', 'b'],
      [],
      [],
      []
    ]);
  });

  it('percent-decodes a fragment, and keeps a malformed one verbatim', () => {
    expect([decodeFragmentId('caf%C3%A9'), decodeFragmentId('%E0%A4%A')]).toEqual(['café', '%E0%A4%A']);
  });

  it('reads #top in any case as the top of the document, and nothing longer', () => {
    expect(['top', 'TOP', 'Top', 'topper', ''].map(isTopFragment)).toEqual([true, true, true, false, false]);
  });

  it('drops a text directive and everything after it', () => {
    expect(['section:~:text=hi', ':~:text=hi', 'plain'].map(stripTextDirective)).toEqual(['section', '', 'plain']);
  });
});
