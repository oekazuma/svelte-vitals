import { describe, it, expect } from 'vitest';
import { resolveActionSha } from '../../scripts/resolve-action-sha.mjs';

function fakeRun(responses: Record<string, string | Error>): (command: string) => string {
  return (command: string) => {
    const key = Object.keys(responses).find((k) => command.startsWith(k));
    if (!key) throw new Error(`unexpected command: ${command}`);
    const res = responses[key]!;
    if (res instanceof Error) throw res;
    return res;
  };
}

describe('resolveActionSha', () => {
  it('returns HEAD when it is already an ancestor of origin/main (the real-release case)', () => {
    const run = fakeRun({
      'git rev-parse HEAD': 'abc123',
      'git merge-base --is-ancestor': ''
    });
    expect(resolveActionSha('/repo', run)).toBe('abc123');
  });

  it('falls back to the nearest ancestor on origin/main when HEAD is not pushed yet', () => {
    const run = fakeRun({
      'git rev-parse HEAD': 'localonly456',
      'git merge-base --is-ancestor': new Error('not an ancestor'),
      'git merge-base HEAD origin/main': 'pushedparent789'
    });
    expect(resolveActionSha('/repo', run)).toBe('pushedparent789');
  });

  it('falls back to HEAD when origin/main is not resolvable at all (e.g. no remote)', () => {
    const run = fakeRun({
      'git rev-parse HEAD': 'onlycommit000',
      'git merge-base --is-ancestor': new Error('unknown revision origin/main'),
      'git merge-base HEAD origin/main': new Error('unknown revision origin/main')
    });
    expect(resolveActionSha('/repo', run)).toBe('onlycommit000');
  });
});
