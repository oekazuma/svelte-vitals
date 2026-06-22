import { describe, it, expect } from 'vitest';
import { handleExplainRule } from '../src/tools/explain-rule.js';

describe('explain_rule tool', () => {
  it('returns the full RuleInfo payload for a known id', async () => {
    const res = await handleExplainRule({ id: 'SEO001' });
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
    expect(info.id).toBe('SEO001');
    expect(info.title).toBe('Title presence');
    expect(info.category).toBe('seo');
    expect(info.severity).toBe('critical');
    expect(info.rationale.length).toBeGreaterThan(0);
    expect(info.docsUrl).toBe('https://svelte-vitals.dev/rules/SEO001');
    expect(info.fix?.description.length).toBeGreaterThan(0);
    // The text rendering carries the same id and docs link.
    expect(res.content[0]!.text).toContain('SEO001');
    expect(res.content[0]!.text).toContain('https://svelte-vitals.dev/rules/SEO001');
  });

  it('resolves the rule id case-insensitively', async () => {
    const res = await handleExplainRule({ id: 'seo001' });
    expect(res.isError).toBeFalsy();
    const info = res.structuredContent as { id: string };
    expect(info.id).toBe('SEO001');
  });

  it('reports an error for an unknown id', async () => {
    const res = await handleExplainRule({ id: 'NOPE999' });
    expect(res.isError).toBe(true);
    const text = res.content[0]!.text;
    expect(text).toContain('Unknown rule id: NOPE999');
    expect(text).toContain('Known rule ids:');
    expect(text).toContain('SEO001');
  });
});
