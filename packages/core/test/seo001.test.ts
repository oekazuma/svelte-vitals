import { describe, it, expect } from 'vitest';
import {
  seoTitlePresence,
  runRules,
  summarize,
  classify,
  formatConsoleReport,
  defaultConfig,
  defaultProject,
  type ResolvedHead,
  type Config
} from '../src/index.js';

const config: Config = defaultConfig;

function head(route: string, file: string, title?: ResolvedHead['tags'][number]): ResolvedHead {
  return { route, file, source: 'static', tags: title ? [title] : [] };
}

const staticHead = head('/static', 'src/routes/static/+page.svelte', {
  kind: 'title',
  presence: 'own',
  value: 'static'
});
const dynamicHead = head('/dynamic', 'src/routes/dynamic/+page.svelte', {
  kind: 'title',
  presence: 'own',
  value: 'dynamic'
});
const noneHead = head('/none', 'src/routes/none/+page.svelte');
const inheritedHead = head('/child', 'src/routes/child/+page.svelte', {
  kind: 'title',
  presence: 'inherited',
  value: 'static'
});

describe('seo/title-presence title detection', () => {
  it('detects a static title as present (own/static)', async () => {
    const [result] = await seoTitlePresence.check({ heads: [staticHead], project: defaultProject, config });
    expect(result!.detection).toEqual({ presence: 'own', value: 'static' });
    expect(classify(result!, config)).toBe('pass');
  });

  it('treats a dynamic title as present and never penalizes it', async () => {
    const [result] = await seoTitlePresence.check({ heads: [dynamicHead], project: defaultProject, config });
    expect(result!.detection).toEqual({ presence: 'own', value: 'dynamic' });
    expect(classify(result!, config)).toBe('dynamic');
  });

  it('flags a missing title as none/absent (fail)', async () => {
    const [result] = await seoTitlePresence.check({ heads: [noneHead], project: defaultProject, config });
    expect(result!.detection).toEqual({ presence: 'none', value: 'absent' });
    expect(classify(result!, config)).toBe('fail');
    expect(result!.message).toBe('Missing <title>');
  });

  it('passes an inherited title', async () => {
    const [result] = await seoTitlePresence.check({ heads: [inheritedHead], project: defaultProject, config });
    expect(result!.detection).toEqual({ presence: 'inherited', value: 'static' });
    expect(classify(result!, config)).toBe('pass');
  });
});

describe('summary + reporter', () => {
  it('summarizes a mixed project', async () => {
    const results = await runRules([seoTitlePresence], {
      heads: [staticHead, dynamicHead, noneHead],
      project: defaultProject,
      config
    });
    const summary = summarize(results, config);
    expect(summary).toEqual({ critical: 1, warning: 0, info: 0, passed: 2, dynamic: 1 });
  });

  it('renders ✗ for missing and ↯ for dynamic', async () => {
    const results = await runRules([seoTitlePresence], {
      heads: [staticHead, dynamicHead, noneHead],
      project: defaultProject,
      config
    });
    const report = formatConsoleReport(results, config, { verbose: true });
    expect(report).toContain('Critical (1)');
    expect(report).toContain('✗ seo/title-presence  Missing <title>');
    expect(report).toContain('↯ dynamic');
    expect(report).toContain('/static');
  });
});
