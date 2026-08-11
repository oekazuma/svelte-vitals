import { describe, it, expect } from 'vitest';
import { runExplainCliGunshi } from '../src/gunshi/explain.js';
import { captureIO } from './helpers/capture-io.js';

async function explain(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const io = captureIO();
  const code = await runExplainCliGunshi(args, io);
  return { code, out: io.out, err: io.err };
}

describe('svelte-vitals explain', () => {
  it('renders the full metadata for a known id', async () => {
    const { code, out } = await explain(['seo/title-presence']);
    expect(code).toBe(0);
    expect(out).toContain('seo/title-presence — Title presence (critical, seo)');
    expect(out).toContain('Docs: https://oekazuma.github.io/svelte-vitals/rules/seo/title-presence');
    expect(out).toContain('Fix: ');
  });

  it('says nothing about options for a rule that takes none', async () => {
    expect((await explain(['seo/title-presence'])).out).not.toContain('Configurable');
  });

  it("renders a configurable rule's options, defaults, bounds and merge semantics", async () => {
    const { out } = await explain(['seo/title-length']);
    expect(out).toContain("rules: { 'seo/title-length': { options: { … } } }");
    expect(out).toContain('min (integer, default 30, >= 0) — replaces the default');
    expect(out).toContain('max (integer, default 60, >= 1) — replaces the default');
  });

  it('states that a list option appends to the built-in entries', async () => {
    const { out } = await explain(['performance/preconnect']);
    expect(out).toContain('origins (string-list, default ["fonts.googleapis.com"');
    expect(out).toContain('added to the default entries, never replaces them');
  });

  it('states that a map option overrides the value of a built-in key', async () => {
    // `{ ...defaults, ...configured }`: "never replaces" would be wrong here, unlike string-list.
    const { out } = await explain(['performance/heavy-import']);
    expect(out).toContain('packages (string-map, default {');
    expect(out).toContain('a new key is added, a built-in key has its value overridden');
    expect(out).not.toContain('never replaces');
  });

  it('--json emits the structured RuleInfo object', async () => {
    const { code, out } = await explain(['--json', 'seo/title-length']);
    expect(code).toBe(0);
    const info = JSON.parse(out) as {
      id: string;
      category: string;
      severity: string;
      docsUrl: string;
      options?: { name: string; kind: string; default: unknown }[];
    };
    expect(info.id).toBe('seo/title-length');
    expect(info.category).toBe('seo');
    expect(info.severity.length).toBeGreaterThan(0);
    expect(info.docsUrl).toBe('https://oekazuma.github.io/svelte-vitals/rules/seo/title-length');
    expect(info.options?.map((o) => o.name)).toEqual(['min', 'max']);
  });

  describe('--list', () => {
    it('lists every registered rule, grouped by category', async () => {
      const { allRules, CATEGORIES } = await import('@svelte-vitals/core');
      const { code, out } = await explain(['--list']);
      expect(code).toBe(0);
      for (const rule of allRules) expect(out).toContain(rule.id);
      for (const category of CATEGORIES) expect(out).toContain(`${category} (`);
      expect(out).toContain(`${allRules.length} rules.`);
    });

    it('--list --json emits id/category/severity/title for every rule', async () => {
      const { allRules } = await import('@svelte-vitals/core');
      const { code, out } = await explain(['--list', '--json']);
      expect(code).toBe(0);
      const parsed = JSON.parse(out) as { id: string; category: string; severity: string; title: string }[];
      expect(parsed.map((r) => r.id)).toEqual(allRules.map((r) => r.id));
      for (const r of parsed) {
        expect(r.category.length).toBeGreaterThan(0);
        expect(r.severity.length).toBeGreaterThan(0);
        expect(r.title.length).toBeGreaterThan(0);
      }
    });

    it('refuses a rule id alongside --list', async () => {
      const { code, out, err } = await explain(['--list', 'performance/heavy-import']);
      expect(code).toBe(2);
      expect(out).toBe('');
      expect(err).toContain('takes no rule id');
    });

    it('names --list when no id is given', async () => {
      expect((await explain([])).err).toContain('--list');
    });
  });

  it('does not match a rule id with the wrong case (exact match only)', async () => {
    const { code, err } = await explain(['SEO/TITLE-PRESENCE']);
    expect(code).toBe(2);
    expect(err).toContain("unknown rule id 'SEO/TITLE-PRESENCE'");
  });

  it('exits 2 and lists the known ids for an unknown id', async () => {
    const { code, out, err } = await explain(['NOPE999']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("unknown rule id 'NOPE999'");
    expect(err).toContain('known rule ids:');
    expect(err).toContain('seo/title-presence');
    // NOPE999 is nowhere near any real rule id — no did-you-mean hint (design doc addendum).
    expect(err).not.toContain('did you mean');
  });

  it('a one-edit typo of a real rule id gets a did-you-mean hint (design doc addendum)', async () => {
    const { code, err } = await explain(['seo/ssr-disable']);
    expect(code).toBe(2);
    expect(err).toContain("unknown rule id 'seo/ssr-disable'");
    expect(err).toContain('svelte-vitals: did you mean `svelte-vitals explain seo/ssr-disabled`?');
  });

  it('the wrong-case rule id above is far enough (case-sensitive match) that it gets no hint either', async () => {
    const { err } = await explain(['SEO/TITLE-PRESENCE']);
    expect(err).not.toContain('did you mean');
  });

  it('exits 2 when no rule id is given', async () => {
    const { code, err } = await explain([]);
    expect(code).toBe(2);
    expect(err).toContain('explain needs a rule id');
  });

  it('--help prints usage and exits 0', async () => {
    const { code, out } = await explain(['--help']);
    expect(code).toBe(0);
    expect(out).toContain('svelte-vitals explain <rule-id>');
    expect(out).toContain('--json');
  });
});
