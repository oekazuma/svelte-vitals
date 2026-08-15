import { describe, it, expect } from 'vitest';
import { allRules, defaultProject, defaultConfig, type ResolvedHead } from '../src/internal.js';

const head: ResolvedHead = { route: '/x', source: 'static', file: 'src/routes/x/+page.svelte', tags: [] };
const ctx = { heads: [head], project: defaultProject, config: defaultConfig };

describe('rule results carry a category', () => {
  it('every SEO rule tags its results category "seo"', async () => {
    for (const rule of allRules) {
      const results = await rule.check(ctx);
      for (const r of results) expect(r.category, rule.id).toBe('seo');
    }
  });
});
