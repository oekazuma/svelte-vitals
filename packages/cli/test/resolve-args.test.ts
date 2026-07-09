import { describe, it, expect } from 'vitest';
import mri from 'mri';
import { resolveArgs } from '../src/resolve-args.js';

/** Parse CLI args the same way `main` does, then normalize them. */
function resolve(...args: string[]) {
  const argv = mri(args, {
    alias: { h: 'help', v: 'version' },
    boolean: ['by-route', 'json', 'fail-on-warning', 'staged', 'score', 'verbose'],
    string: [
      'meta-components',
      'treat-dynamic-as',
      'route',
      'fail-on',
      'reporter',
      'rules',
      'ignore',
      'diff',
      'baseline',
      'weights',
      'category'
    ]
  });
  return resolveArgs(argv);
}

describe('resolveArgs', () => {
  it('accepts a valid --treat-dynamic-as without warning', () => {
    const { options, warnings } = resolve('--treat-dynamic-as', 'fail');
    expect(options?.treatDynamicAs).toBe('fail');
    expect(warnings).toEqual([]);
  });

  it('warns and defaults to pass on an unknown --treat-dynamic-as', () => {
    const { options, warnings } = resolve('--treat-dynamic-as', 'warning');
    expect(options?.treatDynamicAs).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("unknown --treat-dynamic-as 'warning'");
  });

  it('accepts a valid --fail-on without warning', () => {
    const { options, warnings } = resolve('--fail-on', 'warning');
    expect(options?.failOn).toBe('warning');
    expect(warnings).toEqual([]);
  });

  it('warns and applies no threshold on an unknown --fail-on', () => {
    const { options, warnings } = resolve('--fail-on', 'warn');
    expect(options?.failOn).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("unknown --fail-on 'warn'");
  });

  it('lets --fail-on-warning override the threshold', () => {
    const { options, warnings } = resolve('--fail-on-warning');
    expect(options?.failOn).toBe('warning');
    expect(warnings).toEqual([]);
  });

  it('reports an unknown reporter as a fatal error (no options)', () => {
    const { options, errors } = resolve('--reporter', 'xml');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes("unknown reporter 'xml'"))).toBe(true);
  });

  it('reports unknown rule ids as a fatal error (no options)', () => {
    const { options, errors } = resolve('--rules', 'not-a-rule');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('unknown rule id(s)'))).toBe(true);
  });

  it('parses --meta-components into a trimmed, non-empty list', () => {
    const { options } = resolve('--meta-components', 'MetaTags, Seo ,');
    expect(options?.metaComponents).toEqual(['MetaTags', 'Seo']);
  });

  it('maps --json to the json reporter', () => {
    const { options } = resolve('--json');
    expect(options?.reporter).toBe('json');
  });

  it('maps --staged and --diff to changed-file options', () => {
    expect(resolve('--staged').options?.staged).toBe(true);
    expect(resolve('--diff').options?.diffBase).toBe('HEAD'); // bare --diff → default base
    expect(resolve('--diff', 'main').options?.diffBase).toBe('main');
  });

  it('omits diffBase/staged when not passed', () => {
    const { options } = resolve('--json');
    expect(options?.diffBase).toBeUndefined();
    expect(options?.staged).toBeUndefined();
  });

  it('maps --baseline <ref> to options.baseline', () => {
    const { options, errors } = resolve('--baseline', 'origin/main');
    expect(options?.baseline).toBe('origin/main');
    expect(errors).toEqual([]);
  });

  it('reports a bare --baseline (no ref) as a fatal error (no options)', () => {
    const { options, errors } = resolve('--baseline');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('--baseline requires a git ref'))).toBe(true);
  });

  it('leaves rules undefined when neither --rules nor --ignore is passed', () => {
    const { options } = resolve('--json');
    expect(options?.rules).toBeUndefined();
  });

  it('parses --weights into a per-category map, normalizing case', () => {
    const { options, errors } = resolve('--weights', 'SEO=2,performance=1.5');
    expect(errors).toEqual([]);
    expect(options?.weights).toEqual({ seo: 2, performance: 1.5 });
  });

  it('omits weights when --weights is not passed', () => {
    const { options } = resolve('--json');
    expect(options?.weights).toBeUndefined();
  });

  it('reports an unknown category in --weights as a fatal error', () => {
    const { options, errors } = resolve('--weights', 'bogus=2');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('unknown category(ies) in --weights'))).toBe(true);
    expect(errors.some((e) => e.includes('Known categories'))).toBe(true);
  });

  it('reports a negative --weights value as a fatal error', () => {
    const { options, errors } = resolve('--weights', 'seo=-1');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('invalid --weights entry'))).toBe(true);
  });

  it('reports a non-numeric --weights value as a fatal error', () => {
    const { options, errors } = resolve('--weights', 'seo=nope');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('invalid --weights entry'))).toBe(true);
  });

  it('reports an empty --weights value as a fatal error (Number("") must not coerce to 0)', () => {
    const { options, errors } = resolve('--weights', 'seo=');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('invalid --weights entry'))).toBe(true);
  });

  it('reports --weights with no category=number pairs as a fatal error (must not silently clobber config weights)', () => {
    const { options, errors } = resolve('--weights', ',');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('--weights was passed but contains no category=number pairs'))).toBe(true);
  });

  it('parses --category into a normalized, de-duplicated list, mixing case', () => {
    const { options, errors } = resolve('--category', 'seo,SECURITY,seo');
    expect(errors).toEqual([]);
    expect(options?.categories).toEqual(['seo', 'security']);
  });

  it('omits categories when --category is not passed', () => {
    const { options } = resolve('--json');
    expect(options?.categories).toBeUndefined();
  });

  it('reports an unknown category in --category as a fatal error', () => {
    const { options, errors } = resolve('--category', 'bogus');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('unknown category(ies) in --category'))).toBe(true);
    expect(errors.some((e) => e.includes('Known categories'))).toBe(true);
  });

  it('reports --category with no categories (e.g. a bare comma) as a fatal error', () => {
    const { options, errors } = resolve('--category', ',');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('--category was passed but contains no categories'))).toBe(true);
  });

  it('sets score:true when --score is passed', () => {
    const { options, warnings } = resolve('--score');
    expect(options?.score).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('omits score when --score is not passed', () => {
    const { options } = resolve('--json');
    expect(options?.score).toBeUndefined();
  });

  it('warns when --score is combined with --json', () => {
    const { options, warnings } = resolve('--score', '--json');
    expect(options?.score).toBe(true);
    expect(warnings.some((w) => w.includes('--score overrides --reporter'))).toBe(true);
  });

  it('warns when --score is combined with --reporter', () => {
    const { options, warnings } = resolve('--score', '--reporter', 'md');
    expect(options?.score).toBe(true);
    expect(warnings.some((w) => w.includes('--score overrides --reporter'))).toBe(true);
  });

  it('sets explicitPath:true when a positional path is passed', () => {
    const { options } = resolve('apps/web');
    expect(options?.explicitPath).toBe(true);
    expect(options?.cwd).toBe('apps/web');
  });

  it('sets explicitPath:false when no positional path is passed', () => {
    const { options } = resolve('--json');
    expect(options?.explicitPath).toBe(false);
  });

  it('threads --verbose into options.verbose', () => {
    const { options } = resolve('--verbose');
    expect(options?.verbose).toBe(true);
  });

  it('verbose defaults to false (undefined) when not passed', () => {
    const { options } = resolve();
    expect(options?.verbose).toBeUndefined();
  });
});
