import { describe, it, expect } from 'vitest';
import { parseRunArgs, resolveArgs } from '../src/resolve-args.js';

/** Parse CLI args the same way `main` does, then normalize them. */
function resolve(...args: string[]) {
  return resolveArgs(parseRunArgs(args));
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

  it('maps --staged and --diff to changed-file options', () => {
    expect(resolve('--staged').options?.staged).toBe(true);
    expect(resolve('--diff').options?.diffBase).toBe('HEAD'); // bare --diff → default base
    expect(resolve('--diff', 'main').options?.diffBase).toBe('main');
  });

  it('omits diffBase/staged when not passed', () => {
    const { options } = resolve('--reporter', 'json');
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

  it('reports --baseline followed by a flag as a fatal error instead of consuming the flag as the ref', () => {
    for (const args of [['--baseline', '--force'], ['--baseline', '--staged'], ['--baseline=--force']]) {
      const { options, errors } = resolve(...args);
      expect(options).toBeNull();
      expect(errors.some((e) => e.includes('--baseline requires a git ref'))).toBe(true);
    }
  });

  it('treats --staged=false as off, not on', () => {
    expect(resolve('--staged=false').options?.staged).toBeUndefined();
    expect(resolve('--staged=true').options?.staged).toBe(true);
  });

  it('maps --update-suppressions to options.updateSuppressions', () => {
    const { options, errors } = resolve('--update-suppressions');
    expect(options?.updateSuppressions).toBe(true);
    expect(errors).toEqual([]);
  });

  it('maps --no-suppressions to options.noSuppressions', () => {
    const { options, errors } = resolve('--no-suppressions');
    expect(options?.noSuppressions).toBe(true);
    expect(errors).toEqual([]);
  });

  it('omits updateSuppressions/noSuppressions when neither flag is passed', () => {
    const { options } = resolve('--reporter', 'json');
    expect(options?.updateSuppressions).toBeUndefined();
    expect(options?.noSuppressions).toBeUndefined();
  });

  it('reports --update-suppressions with --no-suppressions as a fatal error (no options)', () => {
    const { options, errors } = resolve('--update-suppressions', '--no-suppressions');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes('--update-suppressions and --no-suppressions cannot be used together'))).toBe(
      true
    );
  });

  // `--rules`/`--ignore` travel as id lists (`allowRules`/`ignoreRules`); `rules` is reserved for
  // a caller's whole-field replacement (the config file or a programmatic caller), which the CLI
  // never synthesizes (design 2026-08-06).
  it('carries --rules as an id list and leaves rules unset', () => {
    const options = resolve('--rules', 'seo/title-presence').options;
    expect(options?.allowRules).toEqual(['seo/title-presence']);
    expect(options?.rules).toBeUndefined();
  });

  it('carries --ignore as an id list, independent of --rules', () => {
    const options = resolve('--ignore', 'seo/canonical-url').options;
    expect(options?.ignoreRules).toEqual(['seo/canonical-url']);
    expect(options?.allowRules).toBeUndefined();
  });

  it('carries both id lists when both flags are passed', () => {
    const options = resolve('--rules', 'seo/title-presence', '--ignore', 'seo/canonical-url').options;
    expect(options?.allowRules).toEqual(['seo/title-presence']);
    expect(options?.ignoreRules).toEqual(['seo/canonical-url']);
  });

  it('leaves every rule-selection field undefined when neither flag is passed', () => {
    const options = resolve().options;
    expect(options?.rules).toBeUndefined();
    expect(options?.allowRules).toBeUndefined();
    expect(options?.ignoreRules).toBeUndefined();
  });

  it('parses --weights into a per-category map, normalizing case', () => {
    const { options, errors } = resolve('--weights', 'SEO=2,performance=1.5');
    expect(errors).toEqual([]);
    expect(options?.weights).toEqual({ seo: 2, performance: 1.5 });
  });

  it('omits weights when --weights is not passed', () => {
    const { options } = resolve('--reporter', 'json');
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
    const { options } = resolve('--reporter', 'json');
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
    const { options } = resolve('--reporter', 'json');
    expect(options?.score).toBeUndefined();
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
    const { options } = resolve('--reporter', 'json');
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

  it('threads --no-color into options.noColor', () => {
    const { options } = resolve('--no-color');
    expect(options?.noColor).toBe(true);
  });

  it('noColor defaults to false (undefined) when --no-color is not passed', () => {
    const { options } = resolve();
    expect(options?.noColor).toBeUndefined();
  });

  it('threads --no-animation into options.noAnimation', () => {
    const { options } = resolve('--no-animation');
    expect(options?.noAnimation).toBe(true);
  });

  it('noAnimation defaults to false (undefined) when --no-animation is not passed', () => {
    const { options } = resolve();
    expect(options?.noAnimation).toBeUndefined();
  });

  // parseArgs (strict:false) lets a declared string flag consume a following flag token
  // instead of erroring, so a misconfigured value silently becomes another flag's name.
  const VALUE_FLAGS = [
    'meta-components',
    'treat-dynamic-as',
    'route',
    'fail-on',
    'reporter',
    'rules',
    'ignore',
    'min-health',
    'out-file',
    'weights',
    'category'
  ];

  it.each(VALUE_FLAGS)('reports --%s followed by a flag as a fatal error instead of consuming it', (flag) => {
    const { options, errors } = resolve(`--${flag}`, '--staged');
    expect(options).toBeNull();
    expect(errors.some((e) => e.includes(`--${flag} requires a value`))).toBe(true);
  });

  it.each(['min-health', 'reporter', 'meta-components'])('reports --%s= (empty value) as a fatal error', (flag) => {
    const { options, errors } = resolve(`--${flag}=`);
    expect(options).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  describe('--min-health', () => {
    it('reports a non-numeric value as a fatal error', () => {
      const { options, errors } = resolve('--min-health=abc');
      expect(options).toBeNull();
      expect(errors.some((e) => e.includes('invalid --min-health'))).toBe(true);
    });

    it('reports an out-of-range value (150) as a fatal error', () => {
      const { options, errors } = resolve('--min-health=150');
      expect(options).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
    });

    it('reports a negative value (-1) as a fatal error', () => {
      const { options, errors } = resolve('--min-health=-1');
      expect(options).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
    });

    it('accepts 0, 100, and a mid-range value', () => {
      expect(resolve('--min-health=0').minHealth).toBe(0);
      expect(resolve('--min-health=100').minHealth).toBe(100);
      expect(resolve('--min-health=85').minHealth).toBe(85);
    });
  });

  it('exempts --diff from the value guard: bare and flag-followed both default to HEAD', () => {
    expect(resolve('--diff').options?.diffBase).toBe('HEAD');
    expect(resolve('--diff', '--staged').options?.diffBase).toBe('HEAD');
  });
});
