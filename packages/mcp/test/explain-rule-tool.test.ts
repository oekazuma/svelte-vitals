import { describe, it, expect } from 'vitest';
import { handleExplainRule } from '../src/tools/explain-rule.js';

describe('explain_rule tool', () => {
  it('returns the full RuleInfo payload for a known id', async () => {
    const res = await handleExplainRule({ id: 'seo/title-presence' });
    expect(res.isError).toBeFalsy();
    const info = res.structuredContent as {
      id: string;
      title: string;
      category: string;
      severity: string;
      rationale: string;
      docsUrl: string;
      fix?: { description: string };
    };
    expect(info.id).toBe('seo/title-presence');
    expect(info.title).toBe('Title presence');
    expect(info.category).toBe('seo');
    expect(info.severity).toBe('critical');
    expect(info.rationale.length).toBeGreaterThan(0);
    expect(info.docsUrl).toBe('https://oekazuma.github.io/svelte-vitals/rules/seo/title-presence');
    expect(info.fix?.description.length).toBeGreaterThan(0);
    // The text rendering carries the same id and docs link.
    expect(res.content[0]!.text).toContain('seo/title-presence');
    expect(res.content[0]!.text).toContain('https://oekazuma.github.io/svelte-vitals/rules/seo/title-presence');
  });

  it('says nothing about options for a rule that takes none', async () => {
    const res = await handleExplainRule({ id: 'seo/title-presence' });
    expect(res.content[0]!.text).not.toContain('Configurable');
  });

  it("renders a configurable rule's options, defaults, bounds and merge semantics", async () => {
    // An agent that reads a finding as a threshold disagreement rather than a defect
    // has to learn the knob's name from somewhere; explain_rule is that somewhere.
    const res = await handleExplainRule({ id: 'seo/title-length' });
    const text = res.content[0]!.text;
    expect(text).toContain("rules: { 'seo/title-length': { options: { … } } }");
    expect(text).toContain('min (integer, default 30, >= 0) — replaces the default');
    expect(text).toContain('max (integer, default 60, >= 1) — replaces the default');
    const info = res.structuredContent as { options?: { name: string }[] };
    expect(info.options?.map((o) => o.name)).toEqual(['min', 'max']);
  });

  it('states that a list option appends to the built-in entries', async () => {
    const res = await handleExplainRule({ id: 'performance/preconnect' });
    expect(res.content[0]!.text).toContain('origins (string-list, default ["fonts.googleapis.com"');
    expect(res.content[0]!.text).toContain('added to the default entries, never replaces them');
  });

  it('states that a map option overrides the value of a built-in key', async () => {
    // `{ ...defaults, ...configured }` — so `{ lodash: 'my advice' }` rewords the
    // built-in advice for lodash rather than only extending the list. Saying "never
    // replaces" here would be wrong, and an agent acting on it would tell the user
    // their reworded advice cannot take effect.
    const res = await handleExplainRule({ id: 'performance/heavy-import' });
    const text = res.content[0]!.text;
    expect(text).toContain('packages (string-map, default {');
    expect(text).toContain('a new key is added, a built-in key has its value overridden');
    expect(text).not.toContain('never replaces');
  });

  it('does not match a rule id with the wrong case (exact match only)', async () => {
    const res = await handleExplainRule({ id: 'SEO/TITLE-PRESENCE' });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('Unknown rule id: SEO/TITLE-PRESENCE');
  });

  it('reports an error for an unknown id', async () => {
    const res = await handleExplainRule({ id: 'NOPE999' });
    expect(res.isError).toBe(true);
    const text = res.content[0]!.text;
    expect(text).toContain('Unknown rule id: NOPE999');
    expect(text).toContain('Known rule ids:');
    expect(text).toContain('seo/title-presence');
  });
});
