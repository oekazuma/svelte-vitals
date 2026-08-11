import { describe, it, expect } from 'vitest';
import { mdEscape, terminalSafe } from '../src/reporter/sanitize.js';

describe('mdEscape', () => {
  it('wraps a tag in enough backticks to survive a backtick run inside it', () => {
    expect(mdEscape('<meta content="``">')).toBe('```<meta content="``">```');
  });

  it('leaves ordinary route-style bracket text alone (no link syntax present)', () => {
    expect(mdEscape('src/routes/blog/[slug]/+page.svelte')).toBe('src/routes/blog/[slug]/+page.svelte');
  });

  it('leaves clean text without tags/links/newlines untouched', () => {
    expect(mdEscape('Missing robots.txt')).toBe('Missing robots.txt');
  });
});

describe('terminalSafe', () => {
  it('strips a lone, unterminated escape byte', () => {
    expect(terminalSafe('before\x1bafter')).toBe('beforeafter');
  });

  it('keeps newlines and tabs', () => {
    expect(terminalSafe('line one\n\tline two')).toBe('line one\n\tline two');
  });

  it('strips a bare carriage return (line-overwrite spoofing)', () => {
    expect(terminalSafe('looks fine\roverwritten')).toBe('looks fineoverwritten');
  });

  it('leaves clean text untouched', () => {
    expect(terminalSafe('src/routes/blog/+page.svelte')).toBe('src/routes/blog/+page.svelte');
  });
});
