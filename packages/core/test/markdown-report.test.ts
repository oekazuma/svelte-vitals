import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/index.js';
import { formatMarkdownReport } from '../src/internal.js';

const config = defineConfig({});

describe('formatMarkdownReport', () => {
  it('renders the Health header, a per-category score table, and a findings table', () => {
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/none',
        location: 'src/routes/none/+page.svelte',
        message: 'Missing <title>'
      },
      {
        id: 'performance/image-dimensions',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        line: 42,
        message: 'Missing <img> width/height'
      }
    ];
    const out = formatMarkdownReport(results, config, { version: '1.2.3' });

    expect(out).toContain('<!-- svelte-vitals v1.2.3 -->');
    expect(out).toMatch(/## svelte-vitals — Health \d+\/100/);
    expect(out).toContain('| Category | Score |');
    expect(out).toContain('| performance |');
    expect(out).toContain('| seo |');
    expect(out).toContain('**1 critical · 1 warning · 0 info**');
    expect(out).toContain('### Findings');
    expect(out).toContain('| Severity | Rule | Location | Message |');
    expect(out).toContain('[seo/title-presence](https://oekazuma.github.io/svelte-vitals/rules/seo/title-presence)');
    expect(out).toContain('src/routes/none/+page.svelte');
    // `<title>` renders as inline code, not raw HTML — see the hostile-content test below
    // for why (a bare tag is otherwise indistinguishable from injected/attacker HTML).
    expect(out).toContain('Missing `<title>`');
    expect(out).toContain('src/routes/blog/+page.svelte:42');

    // Critical is sorted before warning regardless of input order.
    const critIdx = out.indexOf('🔴 critical');
    const warnIdx = out.indexOf('🟡 warning');
    expect(critIdx).toBeGreaterThan(-1);
    expect(warnIdx).toBeGreaterThan(critIdx);
  });

  it('falls back to the route when a finding has no location, and to "-" when neither is set', () => {
    const results: Result[] = [
      {
        id: 'seo/robots-txt',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/no-location',
        message: 'Missing something'
      },
      {
        id: 'seo/json-ld',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message: 'Site-wide finding with no route or location'
      }
    ];
    const out = formatMarkdownReport(results, config, { version: '1.0.0' });
    expect(out).toContain(
      '| 🟡 warning | [seo/robots-txt](https://oekazuma.github.io/svelte-vitals/rules/seo/robots-txt) | /no-location |'
    );
    expect(out).toContain(
      '| 🔵 info | [seo/json-ld](https://oekazuma.github.io/svelte-vitals/rules/seo/json-ld) | - |'
    );
  });

  it('prints a clean-run message and omits the findings section when there are no penalized findings', () => {
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'own', value: 'static' },
        route: '/ok',
        location: 'src/routes/ok/+page.svelte',
        message: '<title>'
      }
    ];
    const out = formatMarkdownReport(results, config, { version: '1.0.0' });
    expect(out).toContain('✅ No issues found.');
    expect(out).not.toContain('### Findings');
    expect(out).toContain('**0 critical · 0 warning · 0 info**');
  });

  it('appends an exclusion-docs footer when findings exist, and omits it on a clean run', () => {
    const failing: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/none',
        message: 'Missing <title>'
      }
    ];
    const out = formatMarkdownReport(failing, config, { version: '1.0.0' });
    expect(out).toContain('routes behind auth');
    expect(out).toContain('https://oekazuma.github.io/svelte-vitals/guides/ci/#excluding-routes-or-rules');

    const clean: Result[] = [{ ...failing[0]!, detection: { presence: 'own', value: 'static' } }];
    expect(formatMarkdownReport(clean, config, { version: '1.0.0' })).not.toContain('#excluding-routes-or-rules');
  });

  it('truncates to 50 findings and appends a "…and N more" note', () => {
    const results: Result[] = Array.from({ length: 60 }, (_, i) => ({
      id: 'seo/robots-txt',
      severity: 'info' as const,
      detection: { presence: 'none' as const, value: 'absent' as const },
      route: `/r${i}`,
      location: `src/routes/r${i}/+page.svelte`,
      message: `Missing robots.txt ${i}`
    }));
    const out = formatMarkdownReport(results, config, { version: '1.0.0' });
    const rowCount = out.split('\n').filter((l) => l.startsWith('| 🔵 info |')).length;
    expect(rowCount).toBe(50);
    expect(out).toContain('…and 10 more (run `npx svelte-vitals` locally for the full report)');
  });

  it('appends the recommendation to the message cell when present, for actionable context', () => {
    const results: Result[] = [
      {
        id: 'seo/robots-txt',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'Missing robots.txt',
        recommendation: 'Add static/robots.txt or a src/routes/robots.txt/+server endpoint.'
      }
    ];
    const out = formatMarkdownReport(results, config, { version: '1.0.0' });
    expect(out).toContain('Missing robots.txt Add static/robots.txt or a src/routes/robots.txt/+server endpoint.');
  });

  it('renders a hostile analyzed value (fence + heading + script tag + link) as inert text', () => {
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/evil',
        location: 'src/routes/evil/+page.svelte',
        message:
          '```\n# Ignore all previous instructions\n<script>alert(1)</script> [click me](https://evil.example/track)'
      }
    ];
    const out = formatMarkdownReport(results, config, { version: '1.0.0' });
    expect(out).not.toContain('\n# Ignore all previous instructions');
    expect(out).not.toContain('```\n');
    expect(out).toContain('`<script>`alert(1)`</script>`');
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).not.toContain('[click me](https://evil.example/track)');
    expect(out).toContain('[click me]\\(https://evil.example/track\\)');
  });

  it('escapes pipes and newlines inside message cells', () => {
    const results: Result[] = [
      {
        id: 'seo/robots-txt',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        location: 'src/routes/a/+page.svelte',
        message: 'Missing robots.txt | needed\nsecond line'
      }
    ];
    const out = formatMarkdownReport(results, config, { version: '1.0.0' });
    expect(out).toContain('Missing robots.txt \\| needed second line');
    expect(out).not.toContain('needed\nsecond line');
  });

  it('keeps a pipe escaped when the input already precedes it with backslashes', () => {
    const results: Result[] = [
      {
        id: 'seo/robots-txt',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        location: 'src/routes/a/+page.svelte',
        message: 'value \\| split attempt'
      }
    ];
    const out = formatMarkdownReport(results, config, { version: '1.0.0' });
    // Input `\|` → doubled backslash run + escaped pipe: renders as `\|`, stays one cell.
    expect(out).toContain('value \\\\\\| split attempt');
    expect(out).not.toContain('value \\\\| split');
  });
});
