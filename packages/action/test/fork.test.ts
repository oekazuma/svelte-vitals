import { describe, it, expect } from 'vitest';
import { isForkPR } from '../src/fork.js';

describe('isForkPR', () => {
  it('is false for a non-pull_request event', () => {
    expect(isForkPR({ eventName: 'push', repoFullName: 'oekazuma/svelte-vitals' })).toBe(false);
  });

  it('is false when there is no head repo info (e.g. push-triggered analysis)', () => {
    expect(isForkPR({ eventName: 'pull_request', repoFullName: 'oekazuma/svelte-vitals' })).toBe(false);
  });

  it('is false for a same-repo PR', () => {
    expect(
      isForkPR({
        eventName: 'pull_request',
        repoFullName: 'oekazuma/svelte-vitals',
        headRepoFullName: 'oekazuma/svelte-vitals'
      })
    ).toBe(false);
  });

  it('is true for a fork PR', () => {
    expect(
      isForkPR({
        eventName: 'pull_request',
        repoFullName: 'oekazuma/svelte-vitals',
        headRepoFullName: 'someone-else/svelte-vitals'
      })
    ).toBe(true);
  });
});
