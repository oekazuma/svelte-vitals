import { describe, it, expect } from 'vitest';
import { resolveRuleOptions, validateRuleOptions, compileOverrides, defineConfig } from '../src/index.js';
import type { RuleOptionsSpec } from '../src/index.js';

const spec: RuleOptionsSpec = {
  max: { kind: 'integer', default: 6, min: 1 },
  packages: { kind: 'string-map', default: { lodash: 'use lodash-es' } },
  origins: { kind: 'string-list', default: ['fonts.googleapis.com'] }
};

describe('resolveRuleOptions', () => {
  it('returns the built-in defaults with an empty config', () => {
    expect(resolveRuleOptions('r', spec, defineConfig({}))).toEqual({
      max: 6,
      packages: { lodash: 'use lodash-es' },
      origins: ['fonts.googleapis.com']
    });
  });
  it('returns an empty object for a rule with no spec', () => {
    expect(resolveRuleOptions('r', undefined, defineConfig({}))).toEqual({});
  });
  it('replaces an integer from the global setting', () => {
    const config = defineConfig({ rules: { r: { options: { max: 10 } } } });
    expect(resolveRuleOptions('r', spec, config).max).toBe(10);
  });
  it('adds to a list rather than replacing it', () => {
    const config = defineConfig({ rules: { r: { options: { origins: ['cdn.example.com'] } } } });
    expect(resolveRuleOptions('r', spec, config).origins).toEqual(['fonts.googleapis.com', 'cdn.example.com']);
  });
  it('adds to a map rather than replacing it', () => {
    const config = defineConfig({ rules: { r: { options: { packages: { moment: 'use dayjs' } } } } });
    expect(resolveRuleOptions('r', spec, config).packages).toEqual({
      lodash: 'use lodash-es',
      moment: 'use dayjs'
    });
  });
  it('lets a matching override replace the global integer', () => {
    const config = defineConfig({
      rules: { r: { options: { max: 10 } } },
      overrides: [{ files: 'src/lib/**', rules: { r: { options: { max: 4 } } } }]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/lib/B.svelte' }).max).toBe(4);
    expect(resolveRuleOptions('r', spec, config, { file: 'src/routes/+page.svelte' }).max).toBe(10);
  });
  it('takes the last matching override for an integer', () => {
    const config = defineConfig({
      overrides: [
        { files: 'src/**', rules: { r: { options: { max: 4 } } } },
        { files: 'src/lib/**', rules: { r: { options: { max: 8 } } } }
      ]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/lib/B.svelte' }).max).toBe(8);
  });
  it('accumulates lists across defaults, global and overrides', () => {
    const config = defineConfig({
      rules: { r: { options: { origins: ['a.example.com'] } } },
      overrides: [{ files: 'src/**', rules: { r: { options: { origins: ['b.example.com'] } } } }]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/x.svelte' }).origins).toEqual([
      'fonts.googleapis.com',
      'a.example.com',
      'b.example.com'
    ]);
  });
  it('ignores options under a category key', () => {
    const config = defineConfig({
      overrides: [{ files: 'src/**', rules: { seo: { options: { max: 99 } } } }]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/x.svelte' }).max).toBe(6);
  });
  it('gives the same answer with a hoisted compiled list', () => {
    const config = defineConfig({ overrides: [{ files: 'src/lib/**', rules: { r: { options: { max: 4 } } } }] });
    const compiled = compileOverrides(config);
    expect(resolveRuleOptions('r', spec, config, { file: 'src/lib/B.svelte' }, compiled).max).toBe(4);
  });
  it('does not mutate the spec defaults across calls', () => {
    const config = defineConfig({ rules: { r: { options: { origins: ['x.example.com'] } } } });
    resolveRuleOptions('r', spec, config);
    expect(resolveRuleOptions('r', spec, defineConfig({})).origins).toEqual(['fonts.googleapis.com']);
  });
});

describe('validateRuleOptions', () => {
  it('accepts valid options', () => {
    expect(validateRuleOptions('r', spec, { max: 10, origins: ['a.com'], packages: { m: 'x' } })).toEqual([]);
  });
  it('rejects an unknown option key', () => {
    expect(validateRuleOptions('r', spec, { maxx: 10 })[0]).toContain("unknown option 'maxx'");
  });
  it('rejects options on a rule that declares none', () => {
    expect(validateRuleOptions('r', undefined, { max: 1 })[0]).toContain('takes no options');
  });
  it('rejects a non-integer for an integer option', () => {
    expect(validateRuleOptions('r', spec, { max: '10' })[0]).toContain('must be an integer');
    expect(validateRuleOptions('r', spec, { max: 1.5 })[0]).toContain('must be an integer');
  });
  it('rejects an integer below the spec minimum', () => {
    expect(validateRuleOptions('r', spec, { max: 0 })[0]).toContain('must be >= 1');
  });
  it('rejects a non-list for a list option', () => {
    expect(validateRuleOptions('r', spec, { origins: 'a.com' })[0]).toContain('array of non-empty strings');
    expect(validateRuleOptions('r', spec, { origins: [''] })[0]).toContain('array of non-empty strings');
  });
  it('rejects a non-map for a map option', () => {
    expect(validateRuleOptions('r', spec, { packages: ['lodash'] })[0]).toContain('string → non-empty string');
    expect(validateRuleOptions('r', spec, { packages: { lodash: 1 } })[0]).toContain('string → non-empty string');
  });
});
