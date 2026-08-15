import { describe, it, expect } from 'vitest';
import { foldOccurrences, type BranchStep } from '../src/a11y.js';

describe('foldOccurrences (branch-aware, spec Control-flow semantics)', () => {
  const n = (key: string, path: BranchStep[] = [], repeatable = false, line = 1) => ({
    key,
    path,
    repeatable,
    line
  });

  it('sums within a branch, maxes across branches, per key', () => {
    expect(
      foldOccurrences([n('x', [{ group: 0, branch: 0 }]), n('x', [{ group: 0, branch: 0 }])]).get('x')
    ).toHaveLength(2);
    expect(
      foldOccurrences([n('m', [{ group: 0, branch: 0 }]), n('m', [{ group: 0, branch: 1 }])]).get('m')
    ).toHaveLength(1);
    const r = foldOccurrences([
      n('m', [{ group: 0, branch: 0 }], false, 1),
      n('m', [{ group: 0, branch: 1 }], false, 2),
      n('m', [{ group: 0, branch: 1 }], false, 3)
    ]);
    expect(r.get('m')!.map((o) => o.line)).toEqual([2, 3]);
  });

  it('adds unconditional occurrences to the selected branch max', () => {
    const r = foldOccurrences([n('m'), n('m', [{ group: 0, branch: 0 }]), n('m', [{ group: 0, branch: 1 }])]);
    expect(r.get('m')).toHaveLength(2);
  });

  it('drops repeatable occurrences and handles nested groups', () => {
    expect(foldOccurrences([n('x', [], true)]).get('x') ?? []).toHaveLength(0);
    const nested = foldOccurrences([
      n('m', [
        { group: 0, branch: 0 },
        { group: 1, branch: 0 }
      ]),
      n('m', [
        { group: 0, branch: 0 },
        { group: 1, branch: 1 }
      ])
    ]);
    expect(nested.get('m')).toHaveLength(1);
  });

  it('keeps the lowest branch index on a tie', () => {
    const r = foldOccurrences([
      n('m', [{ group: 0, branch: 1 }], false, 9),
      n('m', [{ group: 0, branch: 0 }], false, 4)
    ]);
    expect(r.get('m')!.map((o) => o.line)).toEqual([4]);
  });

  it('folds each key independently', () => {
    const r = foldOccurrences([
      n('a', [{ group: 0, branch: 0 }]),
      n('b', [{ group: 0, branch: 0 }]),
      n('b', [{ group: 0, branch: 1 }]),
      n('b', [{ group: 0, branch: 1 }])
    ]);
    expect(r.get('a')).toHaveLength(1);
    expect(r.get('b')).toHaveLength(2);
  });
});
