import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/index.js';
import {
  buildJsonReport,
  computeHealth,
  computeScore,
  formatAgentReport,
  formatGithubReport,
  formatMarkdownReport,
  formatSarifReport,
  renderAppShell,
  safeHref,
  terminalSafe
} from '../src/internal.js';
import { isDeprecatedAttr } from '../src/html-spec/index.js';

const config = defineConfig({});
const absent = { presence: 'none', value: 'absent' } as const;
const results: Result[] = [
  {
    id: 'seo/description-presence',
    severity: 'warning',
    detection: absent,
    message: 'Missing description',
    route: '/a',
    location: 'src/routes/a/+page.svelte',
    recommendation: 'Add a description.',
    docsUrl: 'https://x.test/d'
  },
  { id: 'seo/robots-txt', severity: 'info', detection: absent, message: 'Missing robots.txt' },
  {
    id: 'seo/canonical',
    severity: 'info',
    detection: absent,
    message: 'Missing canonical',
    route: '/a',
    location: 'src/routes/a/+page.svelte'
  },
  {
    id: 'a11y/img-alt',
    category: 'a11y',
    severity: 'critical',
    detection: absent,
    message: 'Image without alt',
    route: '/b',
    location: 'src/routes/b/+page.svelte',
    line: 3,
    fix: { description: 'Add alt text.', snippet: '<img alt="" />' },
    docsUrl: 'https://x.test/a'
  },
  { id: 'seo/lang', severity: 'warning', detection: { presence: 'own', value: 'static' }, message: 'ok', route: '/a' }
];

describe('agent report', () => {
  it('orders files by their worst finding and findings by severity, with fixes, docs and accept lines', () => {
    expect(formatAgentReport(results, config)).toBe(
      [
      '# svelte-vitals — fixes',
      '',
      'Health: 66/100',
      '',
      '4 issue(s) to fix, ordered most-severe first. Fix critical issues first; warning and info items do not fail the default build. Apply each fix below, then re-run `svelte-vitals` (or the build) and check each finding\'s Accept line. Run `svelte-vitals explain <rule-id>` for any rule\'s rationale and options (works offline).',
      '',
      '## src/routes/b/+page.svelte',
      '',
      '### a11y/img-alt · Image without alt (critical, line 3)',
      '- Fix: Add alt text.',
      '',
      '```svelte',
      '<img alt="" />',
      '```',
      '- Docs: https://x.test/a',
      '- Accept: re-run svelte-vitals; a11y/img-alt passes for /b. If the code is right as written, a reviewed `svelte-vitals-disable-next-line a11y/img-alt` comment directly above line 3 resolves it instead.',
      '',
      '## src/routes/a/+page.svelte',
      '',
      '### seo/description-presence · Missing description (warning)',
      '- Fix: Add a description.',
      '- Docs: https://x.test/d',
      '- Accept: re-run svelte-vitals; seo/description-presence passes for /a.',
      '',
      '### seo/canonical · Missing canonical (info)',
      '- Accept: re-run svelte-vitals; seo/canonical passes for /a.',
      '',
      '## (project)',
      '',
      '### seo/robots-txt · Missing robots.txt (info)',
      '- Accept: re-run svelte-vitals; seo/robots-txt passes.',
      ''
      ].join('\n')
    );
  });

  it('says there is nothing to fix', () => {
    expect(formatAgentReport([], config)).toBe(
      [
      '# svelte-vitals — fixes',
      '',
      'Health: 100/100',
      '',
      'No issues to fix.',
      ''
      ].join('\n')
    );
  });
});

describe('markdown report', () => {
  it('tabulates categories by name and findings by severity', () => {
    expect(formatMarkdownReport(results, config, { version: '9.9.9' })).toBe(
      [
      '<!-- svelte-vitals v9.9.9 -->',
      '## svelte-vitals — Health 66/100',
      '',
      '| Category | Score |',
      '| --- | --- |',
      '| a11y | 40 |',
      '| seo | 93 |',
      '',
      '**1 critical · 1 warning · 2 info** (1 checks passed)',
      '',
      '### Findings',
      '',
      '| Severity | Rule | Location | Message |',
      '| --- | --- | --- | --- |',
      '| 🔴 critical | [a11y/img-alt](https://oekazuma.github.io/svelte-vitals/rules/a11y/img-alt) | src/routes/b/+page.svelte:3 | Image without alt |',
      '| 🟡 warning | [seo/description-presence](https://oekazuma.github.io/svelte-vitals/rules/seo/description-presence) | src/routes/a/+page.svelte | Missing description Add a description. |',
      '| 🔵 info | [seo/canonical](https://oekazuma.github.io/svelte-vitals/rules/seo/canonical) | src/routes/a/+page.svelte | Missing canonical |',
      '| 🔵 info | [seo/robots-txt](https://oekazuma.github.io/svelte-vitals/rules/seo/robots-txt) | - | Missing robots.txt |',
      '',
      '_Expected findings (e.g. routes behind auth)? See [Excluding routes or rules](https://oekazuma.github.io/svelte-vitals/guides/ci/#excluding-routes-or-rules)._'
      ].join('\n')
    );
  });

  it('omits the category table and findings when there are no results', () => {
    expect(formatMarkdownReport([], config, { version: '9.9.9' })).toBe(
      [
      '<!-- svelte-vitals v9.9.9 -->',
      '## svelte-vitals — Health 100/100',
      '',
      '**0 critical · 0 warning · 0 info** (0 checks passed)',
      '',
      '✅ No issues found.'
      ].join('\n')
    );
  });

  it('trails only findings past fifty', () => {
    const many = (n: number): Result[] =>
      Array.from({ length: n }, (_, i) => ({ id: `seo/r${i}`, severity: 'info', detection: absent, message: 'x' }));
    expect(formatMarkdownReport(many(50), config, { version: '1' })).not.toContain('more (run');
    expect(formatMarkdownReport(many(51), config, { version: '1' })).toContain('|\n\n…and 1 more (run');
  });
});

describe('json report', () => {
  it('defaults an issue to the seo category, sorts routes by path, and scores a route without the critical cap', () => {
    const title: Result = { id: 'seo/title-presence', severity: 'critical', detection: absent, message: 'm', route: '/b' };
    const report = buildJsonReport([title, results[0]!], config, { version: '1' });
    const uncapped = computeScore([title], config, { applyCriticalCap: false }).score;
    expect(uncapped).toBeGreaterThan(79);
    expect(report.routes.map((r) => [r.route, r.issues.map((i) => i.category)])).toEqual([
      ['/a', ['seo']],
      ['/b', ['seo']]
    ]);
    expect(report.routes[1]!.score).toBe(uncapped);
  });
});

describe('sarif and github reports', () => {
  it('lists a rule once, fingerprints a line without a location, and names the project home', () => {
    const log = JSON.parse(
      formatSarifReport(
        [results[0]!, results[0]!, { id: 'seo/x', severity: 'warning', detection: absent, message: 'm', route: '/r', line: 4 }],
        config,
        { version: '1' }
      )
    );
    const run = log.runs[0];
    expect(run.tool.driver.rules.map((r: { id: string }) => r.id)).toEqual(['seo/description-presence', 'seo/x']);
    expect(run.tool.driver.informationUri).toBe('https://oekazuma.github.io/svelte-vitals');
    expect(run.results[2].partialFingerprints['svelteVitals/v1']).toBe('seo/x:/r::4');
  });

  it('escapes a comma in an annotation file path', () => {
    expect(formatGithubReport([{ ...results[0]!, location: 'src/a,b.svelte' }], config)).toContain('file=src/a%2Cb.svelte');
  });
});

describe('untrusted text', () => {
  it('drops an unterminated OSC sequence with its payload', () => {
    expect(terminalSafe('ok\x1b]0;evil')).toBe('ok');
  });

  it('accepts an http(s) URL after leading whitespace, and no URL that only contains one', () => {
    expect([safeHref(' https://x.test'), safeHref('javascript:x//https://a.test')]).toEqual([' https://x.test', null]);
  });

  it('renders the app shell around the embedded snapshot, escaping JS line terminators', () => {
    const report = buildJsonReport([{ ...results[0]!, message: 'a\u2028b\u2029c' }], config, { version: '1' });
    const html = renderAppShell({ report, badges: {}, analyzing: false, sequence: 0, live: false, meta: { version: '1' } });
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1"><title>');
    expect(html).toContain('<div class="dv-app" id="dv-app"><header');
    expect(html).toContain('</main></div><script type="application/json"');
    expect([html.includes('a\\u2028b\\u2029c'), html.includes('\u2028'), html.includes('\u2029')]).toEqual([true, false, false]);
  });
});

describe('scoring', () => {
  const one = (severity: Result['severity'], id = 'seo/x', route?: string): Result => ({
    id,
    severity,
    detection: absent,
    message: 'm',
    ...(route ? { route } : {})
  });

  it('keeps the worst deduction per rule, on a route and in the project', () => {
    expect(computeScore([one('critical', 'seo/x', '/a'), one('warning', 'seo/x', '/a')], config).rawScore).toBe(
      computeScore([one('critical', 'seo/x', '/a')], config).rawScore
    );
    expect(computeScore([one('critical'), one('warning')], config).scoreModel.sitePenalty).toBe(15);
  });

  it('caps a project-level critical above 79, and not one that lands exactly on it', () => {
    expect(computeScore([one('critical')], config)).toMatchObject({ score: 79, scoreModel: { criticalCap: 79 } });
    expect(computeScore([one('critical', 'seo/a'), one('warning', 'seo/b'), one('info', 'seo/c')], config)).toMatchObject({
      score: 79,
      scoreModel: { sitePenalty: 21, criticalCap: null }
    });
  });

  it('rejects an invalid weight and an all-zero weighting', () => {
    expect(() => computeHealth(results, { ...config, weights: { seo: -1 } })).toThrow(
      "invalid weight for 'seo'; expected a finite number >= 0."
    );
    expect(() => computeHealth(results, { ...config, weights: { seo: 0, a11y: 0 } })).toThrow(
      'Health weights sum to 0; at least one present category must have a positive weight.'
    );
  });
});

describe('deprecated attributes', () => {
  it('reads the deprecated and obsolete flags of an element attribute', () => {
    expect([isDeprecatedAttr('hr', 'size'), isDeprecatedAttr('a', 'href')]).toEqual([true, false]);
  });
});
