import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/index.js';
import { applyOverrides } from '../src/internal.js';

function finding(overrides: Partial<Result> = {}): Result {
  return {
    id: 'seo/title-presence',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    route: '/dashboard',
    location: 'src/routes/(app)/dashboard/+page.svelte',
    message: 'x',
    category: 'seo',
    ...overrides
  };
}

describe('applyOverrides', () => {
  it('is an identity when overrides is absent or empty', () => {
    const results = [finding()];
    expect(applyOverrides(results, defineConfig({}))).toEqual(results);
    expect(applyOverrides(results, defineConfig({ overrides: [] }))).toEqual(results);
  });

  it("removes matched results entirely on 'off' — failing and passing entries alike", () => {
    const failing = finding();
    const passing = finding({ detection: { presence: 'own', value: 'static' } });
    const otherRoute = finding({ route: '/blog', location: 'src/routes/blog/+page.svelte' });
    const config = defineConfig({ overrides: [{ route: '/dashboard/**', rules: { 'seo/title-presence': 'off' } }] });
    expect(applyOverrides([failing, passing, otherRoute], config)).toEqual([otherRoute]);
  });

  it('rewrites severity for matched results', () => {
    const config = defineConfig({ overrides: [{ route: '/dashboard', rules: { 'seo/title-presence': 'info' } }] });
    const out = applyOverrides([finding()], config);
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe('info');
  });

  it('applies category keys to every rule in that category, defaulting absent category to seo', () => {
    const seo = finding({ category: undefined });
    const perf = finding({ id: 'performance/image-dimensions', category: 'performance' });
    const config = defineConfig({ overrides: [{ route: '/dashboard', rules: { seo: 'off' } }] });
    expect(applyOverrides([seo, perf], config)).toEqual([perf]);
  });

  it('lets a rule-id key beat a category key within one entry', () => {
    const config = defineConfig({
      overrides: [{ route: '/dashboard', rules: { seo: 'off', 'seo/title-presence': 'warning' } }]
    });
    const out = applyOverrides([finding()], config);
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe('warning');
  });

  it('lets later entries win over earlier ones', () => {
    const config = defineConfig({
      overrides: [
        { route: '/dashboard/**', rules: { 'seo/title-presence': 'off' } },
        { route: '/dashboard', rules: { 'seo/title-presence': 'info' } }
      ]
    });
    const out = applyOverrides([finding()], config);
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe('info');
  });

  it('accepts an array of route globs on one entry', () => {
    const config = defineConfig({
      overrides: [{ route: ['/admin', '/account/**'], rules: { 'seo/title-presence': 'off' } }]
    });
    const results = [
      finding({ route: '/admin' }),
      finding({ route: '/account/settings' }),
      finding({ route: '/blog' })
    ];
    expect(applyOverrides(results, config).map((r) => r.route)).toEqual(['/blog']);
  });

  it('matches on files globs against a finding location — the way to target a (group)', () => {
    const grouped = finding();
    const outside = finding({ route: '/blog', location: 'src/routes/blog/+page.svelte' });
    const config = defineConfig({ overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }] });
    expect(applyOverrides([grouped, outside], config)).toEqual([outside]);
  });

  it('matches when either route or files matches (OR semantics)', () => {
    const byRoute = finding({ location: undefined });
    const byFile = finding({ route: '/elsewhere' });
    const neither = finding({ route: '/blog', location: 'src/routes/blog/+page.svelte' });
    const config = defineConfig({
      overrides: [{ route: '/dashboard', files: 'src/routes/(app)/**', rules: { 'seo/title-presence': 'off' } }]
    });
    expect(applyOverrides([byRoute, byFile, neither], config)).toEqual([neither]);
  });

  it('never matches findings that lack both route and location', () => {
    const project = finding({ route: undefined, location: undefined });
    const config = defineConfig({ overrides: [{ route: '**', files: '**', rules: { 'seo/title-presence': 'off' } }] });
    expect(applyOverrides([project], config)).toEqual([project]);
  });

  describe('glob matching', () => {
    function matches(pattern: string, route: string): boolean {
      const config = defineConfig({ overrides: [{ route: pattern, rules: { 'seo/title-presence': 'off' } }] });
      return applyOverrides([finding({ route, location: undefined })], config).length === 0;
    }

    it('matches exact routes literally, anchored at both ends', () => {
      expect(matches('/admin', '/admin')).toBe(true);
      expect(matches('/admin', '/admin/users')).toBe(false);
      expect(matches('/admin', '/blog/admin')).toBe(false);
    });

    it('treats SvelteKit route characters ( ) [ ] as literals', () => {
      expect(matches('/blog/[slug]', '/blog/[slug]')).toBe(true);
      expect(matches('/blog/[slug]', '/blog/s')).toBe(false);
      expect(matches('/(app)/dashboard', '/(app)/dashboard')).toBe(true);
    });

    it('* matches within a segment but never across /', () => {
      expect(matches('/blog/*', '/blog/[slug]')).toBe(true);
      expect(matches('/blog/*', '/blog/a/b')).toBe(false);
      expect(matches('/(*)/dashboard', '/(app)/dashboard')).toBe(true);
    });

    it('** matches across segments', () => {
      expect(matches('/admin/**', '/admin/users/[id]')).toBe(true);
      expect(matches('**', '/anything/at/all')).toBe(true);
    });

    it('a trailing /** also matches the bare prefix', () => {
      expect(matches('/admin/**', '/admin')).toBe(true);
      expect(matches('/admin/**', '/administrator')).toBe(false);
    });
  });
});
