import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');
// Isolate reporter auto-detection from the ambient test-runner environment
// (e.g. CLAUDECODE is set when running inside Claude Code).
const CLEAN_ENV: NodeJS.ProcessEnv = {};

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    log: (line: string) => out.push(line),
    errorLog: (line: string) => err.push(line)
  };
}

describe('run() end-to-end', () => {
  it('returns exit 1 and reports the missing title', async () => {
    const cap = capture();
    const code = await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).toBe(1);

    const report = cap.out.join('\n');
    expect(report).toContain('Critical (2)');
    expect(report).toContain('✗ SEO001  Missing <title>');
    expect(report).toContain('/none');
    expect(report).toContain('↯ dynamic'); // /dynamic passes with marker
  });

  it('returns exit 2 for a non-SvelteKit directory', async () => {
    const cap = capture();
    const code = await run({ cwd: here, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).toBe(2);
    expect(cap.err.join('\n')).toContain('No SvelteKit project found');
  });
});

describe('run() flags', () => {
  it('suppresses a missing title for a metaComponents-declared component', async () => {
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      metaComponents: ['Widget'],
      env: CLEAN_ENV
    });
    const report = cap.out.join('\n');
    // The Critical section should list /none (SEO001 missing title) but NOT /widget —
    // Widget suppression promotes /widget's title detection to dynamic/pass.
    // Extract the Critical block (from header up to the next severity header or Passed).
    const criticalBlock = report.split(/\n(?:Warnings|Info|Passed)\s*\(/)[0];
    expect(criticalBlock).toContain('SEO001  Missing <title>');
    expect(criticalBlock).toContain('/none');
    expect(criticalBlock).not.toContain('/widget');
    expect(code).toBe(1); // /none is still a missing-title critical
  });

  it('limits analysis to a route glob', async () => {
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      route: 'static/**',
      env: CLEAN_ENV
    });
    expect(code).toBe(0); // only /static analyzed, which passes
    expect(cap.out.join('\n')).not.toContain('/none');
  });
});

describe('run() reporters and gating', () => {
  it('emits JSON when reporter is json', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, reporter: 'json' });
    const json = JSON.parse(cap.out.join('\n'));
    expect(json).toHaveProperty('score');
    expect(json).toHaveProperty('routes');
  });

  it('reports project facts: robots/sitemap/html lang all pass for the fixture', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, reporter: 'json' });
    const json = JSON.parse(cap.out.join('\n'));
    const siteIds = json.siteIssues.map((i: { id: string }) => i.id);
    expect(siteIds).not.toContain('SEO006'); // robots.txt present
    expect(siteIds).not.toContain('SEO007'); // sitemap present
    expect(siteIds).not.toContain('SEO009'); // html lang present
  });

  it('fails on warning when failOn=warning', async () => {
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      failOn: 'warning',
      env: CLEAN_ENV
    });
    expect(code).toBe(1); // fixture has warnings (og:image, og:title, canonical missing)
  });

  it('disabling a rule via rules:{id:off} removes its findings', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, reporter: 'json', rules: { SEO002: 'off' } });
    const json = JSON.parse(cap.out.join('\n'));
    const anySEO002 = json.routes.some((r: { issues: { id: string }[] }) => r.issues.some((i) => i.id === 'SEO002'));
    expect(anySEO002).toBe(false);
  });
});

describe('run() performance rules', () => {
  it('reports a Performance finding for an <img> missing dimensions', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, reporter: 'json', log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    const json = JSON.parse(cap.out.join('\n'));
    expect(json.categories.performance).toBeDefined();
    const img = json.routes.find((r: { route: string }) => r.route === '/img');
    expect(img.issues.some((i: { id: string }) => i.id === 'PERF001')).toBe(true);
  });
});

describe('run() accessibility rules', () => {
  it('reports an Accessibility finding for an <img> without alt', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, reporter: 'json', log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    const json = JSON.parse(cap.out.join('\n'));
    expect(json.categories.a11y).toBeDefined();
    const img = json.routes.find((r: { route: string }) => r.route === '/img');
    expect(img.issues.some((i: { id: string }) => i.id === 'a11y_missing_attribute')).toBe(true);
  });
});

describe('run() agent reporter', () => {
  it('emits the agent Markdown report when reporter is agent', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, reporter: 'agent' });
    const out = cap.out.join('\n');
    expect(out).toContain('# svelte-vitals — fixes');
    expect(out).toMatch(/### SEO00\d/);
    expect(out).toContain('- Fix:');
  });

  it('warns on stderr only when the agent reporter is auto-detected from the env', async () => {
    // Auto-detected: no explicit reporter, agent env present → hint on stderr, Markdown on stdout.
    const auto = capture();
    await run({ cwd: fixtureDir, log: auto.log, errorLog: auto.errorLog, env: { CLAUDECODE: '1' } });
    expect(auto.out.join('\n')).toContain('# svelte-vitals — fixes');
    expect(auto.err.join('\n')).toContain('agent reporter auto-selected');

    // Explicit agent reporter: no hint (the user asked for it).
    const explicit = capture();
    await run({ cwd: fixtureDir, log: explicit.log, errorLog: explicit.errorLog, reporter: 'agent' });
    expect(explicit.err.join('\n')).not.toContain('auto-selected');
  });
});

describe('run() sarif & github reporters', () => {
  it('emits parseable SARIF with the missing-title finding as an error', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, reporter: 'sarif', env: CLEAN_ENV });
    const sarif = JSON.parse(cap.out.join('\n'));
    expect(sarif.version).toBe('2.1.0');
    const seo001 = sarif.runs[0].results.find((r: { ruleId: string; level: string }) => r.ruleId === 'SEO001');
    expect(seo001.level).toBe('error');
  });

  it('emits github workflow commands for the missing-title finding', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, reporter: 'github', env: CLEAN_ENV });
    expect(cap.out.join('\n')).toMatch(/::error file=.*\+page\.svelte,title=SEO001%3A/);
  });

  it('auto-selects github under GitHub Actions and hints how to override', async () => {
    const cap = capture();
    await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, env: { GITHUB_ACTIONS: 'true' } });
    expect(cap.out.join('\n')).toContain('::error ');
    expect(cap.err.join('\n')).toContain('github reporter auto-selected');
  });

  it('lets an agent env outrank GitHub Actions', async () => {
    const cap = capture();
    await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: { GITHUB_ACTIONS: 'true', CLAUDECODE: '1' }
    });
    expect(cap.out.join('\n')).toContain('# svelte-vitals — fixes'); // agent Markdown, not workflow commands
  });

  it('emits nothing on stdout for a clean github run (no stray blank line)', async () => {
    const cap = capture();
    // A route glob that matches nothing leaves zero route findings; the fixture's
    // project rules (robots/sitemap/html lang) all pass, so the github reporter
    // produces an empty string — which must not be logged as a blank line.
    const code = await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      reporter: 'github',
      route: 'no-such-route',
      env: CLEAN_ENV
    });
    expect(code).toBe(0);
    expect(cap.out).toEqual([]);
  });
});
