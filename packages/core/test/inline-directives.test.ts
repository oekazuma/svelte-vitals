import { describe, it, expect } from 'vitest';
import { applyInlineDirectives, type DirectiveIndex } from '../src/inline-directives.js';
import type { Result } from '../src/types.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASSING = { presence: 'own', value: 'static' } as const;

const bad = (over: Partial<Result>): Result => ({
  id: 'a11y/id-duplication',
  severity: 'warning',
  detection: PENALIZED,
  route: '/x',
  location: 'src/lib/Card.svelte',
  line: 3,
  message: 'Duplicate id "card"',
  ...over
});

const index = (m: Record<string, { line: number; ruleIds?: string[] }[]>): DirectiveIndex => new Map(Object.entries(m));

const penalized = (r: Result) => r.detection.presence === 'none' || r.detection.value === 'absent';
const label = (id: string) => `label for ${id}`;
const run = (results: Result[], idx: DirectiveIndex) => applyInlineDirectives(results, idx, label, penalized);

describe('applyInlineDirectives', () => {
  it('silences a matching finding and turns the rule+route into a PASS', () => {
    const out = run([bad({})], index({ 'src/lib/Card.svelte': [{ line: 3, ruleIds: ['a11y/id-duplication'] }] }));
    expect(out).toEqual([
      {
        id: 'a11y/id-duplication',
        severity: 'warning',
        detection: PASSING,
        route: '/x',
        location: 'src/lib/Card.svelte',
        message: 'label for a11y/id-duplication'
      }
    ]);
  });

  it('leaves a directive for another rule alone', () => {
    const out = run([bad({})], index({ 'src/lib/Card.svelte': [{ line: 3, ruleIds: ['seo/single-h1'] }] }));
    expect(out.map((r) => r.detection)).toEqual([PENALIZED]);
  });

  it('honours a bare directive with no rule ids', () => {
    const out = run([bad({})], index({ 'src/lib/Card.svelte': [{ line: 3 }] }));
    expect(out.map((r) => r.detection)).toEqual([PASSING]);
  });

  it('emits no PASS while a penalized sibling for the same rule and route survives', () => {
    const out = run(
      [bad({ line: 3 }), bad({ line: 9 })],
      index({ 'src/lib/Card.svelte': [{ line: 3, ruleIds: ['a11y/id-duplication'] }] })
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.line).toBe(9);
    expect(out[0]!.detection).toEqual(PENALIZED);
  });

  it('emits exactly one PASS for a route whose findings span two files, anchored at the first', () => {
    const out = run(
      [bad({ location: 'src/lib/A.svelte', line: 2 }), bad({ location: 'src/lib/B.svelte', line: 5 })],
      index({ 'src/lib/A.svelte': [{ line: 2 }], 'src/lib/B.svelte': [{ line: 5 }] })
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ detection: PASSING, location: 'src/lib/A.svelte' });
    expect(out[0]!.line).toBeUndefined();
  });

  it('silences the same component finding on every route that composed it', () => {
    const out = run(
      [bad({ route: '/a' }), bad({ route: '/b' })],
      index({ 'src/lib/Card.svelte': [{ line: 3, ruleIds: ['a11y/id-duplication'] }] })
    );
    expect(out.map((r) => [r.route, r.detection.presence])).toEqual([
      ['/a', 'own'],
      ['/b', 'own']
    ]);
  });

  it('ignores results with no line, no location, or line 0 — nothing to point a directive at', () => {
    const results = [bad({ line: 0 }), bad({ line: undefined }), bad({ location: undefined, line: 3 })];
    expect(run(results, index({ 'src/lib/Card.svelte': [{ line: 0 }, { line: 3 }] }))).toEqual(results);
  });

  it('never touches a result that was not penalized', () => {
    const pass: Result = { id: 'a11y/id-duplication', severity: 'warning', detection: PASSING, message: 'ok' };
    expect(run([pass], index({ 'src/lib/Card.svelte': [{ line: 3 }] }))).toEqual([pass]);
  });

  it('drops the defect message, line and fix from the PASS it builds', () => {
    const out = run([bad({ fix: { description: 'do the thing' } })], index({ 'src/lib/Card.svelte': [{ line: 3 }] }));
    expect(out[0]!.message).toBe('label for a11y/id-duplication');
    expect(out[0]!.line).toBeUndefined();
    expect(out[0]!.fix).toBeUndefined();
  });
});
