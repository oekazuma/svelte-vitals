import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/index.js';
import { formatGithubReport } from '../src/internal.js';

const config = defineConfig({});

describe('formatGithubReport', () => {
  it('emits a workflow command per penalized finding with mapped level and file', () => {
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/none',
        location: 'src/routes/none/+page.svelte',
        message: 'Missing <title>'
      }
    ];
    const out = formatGithubReport(results, config);
    expect(out).toBe(
      '::error file=src/routes/none/+page.svelte,title=seo/title-presence%3A Title presence::Missing <title>'
    );
  });

  it('omits file= for findings without a location and maps info → notice', () => {
    const results: Result[] = [
      {
        id: 'seo/robots-txt',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'Missing robots.txt'
      },
      {
        id: 'seo/json-ld',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        route: '/x',
        location: 'src/routes/x/+page.svelte',
        message: 'JSON-LD missing'
      }
    ];
    const lines = formatGithubReport(results, config).split('\n');
    expect(lines[0]).toBe('::warning title=seo/robots-txt%3A robots.txt::Missing robots.txt');
    expect(lines[1]).toBe(
      '::notice file=src/routes/x/+page.svelte,title=seo/json-ld%3A JSON-LD structured data::JSON-LD missing'
    );
  });

  it('escapes property values (: ,) and message data (newline), but not : or , in message data', () => {
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        location: 'src/routes/a/+page.svelte',
        message: 'Missing title: needed',
        recommendation: 'Add <title>, set it.\nSecond line'
      }
    ];
    const out = formatGithubReport(results, config);
    // title property: colon escaped to %3A
    expect(out).toContain('title=seo/title-presence%3A Title presence');
    // message data: newline → %0A; colon and comma stay literal
    expect(out).toContain('::Missing title: needed Add <title>, set it.%0ASecond line');
    // The embedded newline can't split this into two workflow-command lines (which would
    // let a hostile message forge its own `::` annotation) — it stays one `::` command.
    expect(out.split('\n')).toHaveLength(1);
  });

  it('uses result.line in the annotation when present', () => {
    const results: Result[] = [
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
    const out = formatGithubReport(results, config);
    expect(out).toContain('line=42');
  });

  it('returns an empty string when there are no penalized findings', () => {
    const passing: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'own', value: 'static' },
        route: '/ok',
        location: 'src/routes/ok/+page.svelte',
        message: '<title>'
      }
    ];
    expect(formatGithubReport(passing, config)).toBe('');
  });
});
