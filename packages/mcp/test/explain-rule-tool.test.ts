import { describe, it, expect } from 'vitest';
import { handleExplainRule } from '../src/tools/explain-rule.js';

describe('explain_rule tool', () => {
  it('returns rule info for a known id', async () => {
    const res = await handleExplainRule({ id: 'SEO001' });
    expect(res.isError).toBeFalsy();
    const info = res.structuredContent as { id: string; severity: string; docsUrl: string };
    expect(info.id).toBe('SEO001');
    expect(info.severity).toBe('critical');
    expect(info.docsUrl).toBe('https://svelte-vitals.dev/rules/SEO001');
  });

  it('reports an error for an unknown id', async () => {
    const res = await handleExplainRule({ id: 'NOPE999' });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('NOPE999');
  });
});
