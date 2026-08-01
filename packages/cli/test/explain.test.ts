import { describe, it, expect } from 'vitest';
import { runExplainCli, type ExplainIO } from '../src/explain.js';

/** Collect what `explain` writes so the assertions can read stdout and stderr apart. */
function capture(): ExplainIO & { out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    log: (line) => out.push(line),
    errorLog: (line) => err.push(line),
    get out() {
      return out.join('\n');
    },
    get err() {
      return err.join('\n');
    }
  };
}

function explain(args: string[]): { code: number; out: string; err: string } {
  const io = capture();
  const code = runExplainCli(args, io);
  return { code, out: io.out, err: io.err };
}

describe('svelte-vitals explain', () => {
  it('renders the full metadata for a known id', () => {
    const { code, out } = explain(['seo/title-presence']);
    expect(code).toBe(0);
    expect(out).toContain('seo/title-presence — Title presence (critical, seo)');
    expect(out).toContain('Docs: https://oekazuma.github.io/svelte-vitals/rules/seo/title-presence');
    expect(out).toContain('Fix: ');
  });

  it('says nothing about options for a rule that takes none', () => {
    expect(explain(['seo/title-presence']).out).not.toContain('Configurable');
  });

  it("renders a configurable rule's options, defaults, bounds and merge semantics", () => {
    // A reader who takes a finding as a threshold disagreement rather than a defect has
    // to learn the knob's name from somewhere; `explain` is that somewhere.
    const { out } = explain(['seo/title-length']);
    expect(out).toContain("rules: { 'seo/title-length': { options: { … } } }");
    expect(out).toContain('min (integer, default 30, >= 0) — replaces the default');
    expect(out).toContain('max (integer, default 60, >= 1) — replaces the default');
  });

  it('states that a list option appends to the built-in entries', () => {
    const { out } = explain(['performance/preconnect']);
    expect(out).toContain('origins (string-list, default ["fonts.googleapis.com"');
    expect(out).toContain('added to the default entries, never replaces them');
  });

  it('states that a map option overrides the value of a built-in key', () => {
    // `{ ...defaults, ...configured }` — so `{ lodash: 'my advice' }` rewords the
    // built-in advice for lodash rather than only extending the list. Saying "never
    // replaces" here would be wrong, and a reader acting on it would conclude their
    // reworded advice cannot take effect.
    const { out } = explain(['performance/heavy-import']);
    expect(out).toContain('packages (string-map, default {');
    expect(out).toContain('a new key is added, a built-in key has its value overridden');
    expect(out).not.toContain('never replaces');
  });

  it('--json emits the structured RuleInfo object', () => {
    const { code, out } = explain(['--json', 'seo/title-length']);
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
      const { code, out } = explain(['--list']);
      expect(code).toBe(0);
      for (const rule of allRules) expect(out).toContain(rule.id);
      for (const category of CATEGORIES) expect(out).toContain(`${category} (`);
      expect(out).toContain(`${allRules.length} rules.`);
    });

    it('--list --json emits id/category/severity/title for every rule', async () => {
      const { allRules } = await import('@svelte-vitals/core');
      const { code, out } = explain(['--list', '--json']);
      expect(code).toBe(0);
      const parsed = JSON.parse(out) as { id: string; category: string; severity: string; title: string }[];
      expect(parsed.map((r) => r.id)).toEqual(allRules.map((r) => r.id));
      for (const r of parsed) {
        expect(r.category.length).toBeGreaterThan(0);
        expect(r.severity.length).toBeGreaterThan(0);
        expect(r.title.length).toBeGreaterThan(0);
      }
    });

    it('tells a reader with no id that --list exists, instead of only dumping ids', () => {
      // Discovering `explain` by passing a wrong id and reading the error is an accident;
      // the no-id path has to name the affordance.
      expect(explain([]).err).toContain('--list');
    });
  });

  it('does not match a rule id with the wrong case (exact match only)', () => {
    const { code, err } = explain(['SEO/TITLE-PRESENCE']);
    expect(code).toBe(2);
    expect(err).toContain("unknown rule id 'SEO/TITLE-PRESENCE'");
  });

  it('exits 2 and lists the known ids for an unknown id', () => {
    const { code, out, err } = explain(['NOPE999']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("unknown rule id 'NOPE999'");
    expect(err).toContain('known rule ids:');
    expect(err).toContain('seo/title-presence');
  });

  it('exits 2 when no rule id is given', () => {
    const { code, err } = explain([]);
    expect(code).toBe(2);
    expect(err).toContain('explain needs a rule id');
  });

  it('--help prints usage and exits 0', () => {
    const { code, out } = explain(['--help']);
    expect(code).toBe(0);
    expect(out).toContain('svelte-vitals explain <rule-id>');
    expect(out).toContain('--json');
  });
});
