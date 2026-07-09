import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');
const configFileFixtureDir = join(here, 'fixtures', 'config-file-project');
const configFileInvalidFixtureDir = join(here, 'fixtures', 'config-file-invalid-project');
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
    // verbose:true — this test predates the default capped/grouped console output
    // (Tasks 1-4 of the console-reporter-compact-animated plan) and asserts on the
    // fully-itemized Passed list, so it opts into the old uncapped rendering here
    // rather than being rewritten to check the new default's collapsed summary.
    const code = await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV, verbose: true });
    expect(code).toBe(1);

    const report = cap.out.join('\n');
    expect(report).toContain('Critical (2)');
    expect(report).toContain('✗ SEO001  Missing <title>');
    expect(report).toContain('/none');
    expect(report).toContain('↯ dynamic'); // /dynamic passes with marker
  });

  it('returns exit 2 for a non-SvelteKit directory (explicit path — no monorepo discovery)', async () => {
    const cap = capture();
    // explicitPath: true because `here` stands in for a user-provided path in this test;
    // otherwise run() would try the monorepo picker (design doc
    // 2026-07-08-monorepo-app-picker-design.md) since this dir's own subtree contains the
    // discover-apps.test.ts fixtures. See run-discover.test.ts for the discovery paths.
    const code = await run({ cwd: here, explicitPath: true, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
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

describe('run() --min-health validation', () => {
  it('returns exit 2 for an out-of-range minHealth (150)', async () => {
    const cap = capture();
    const code = await run({ cwd: fixtureDir, minHealth: 150, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).toBe(2);
    expect(cap.err.join('\n')).toContain('invalid minHealth');
  });

  it('returns exit 2 for a NaN minHealth', async () => {
    const cap = capture();
    const code = await run({ cwd: fixtureDir, minHealth: NaN, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).toBe(2);
    expect(cap.err.join('\n')).toContain('invalid minHealth');
  });
});

describe('run() --min-health gate', () => {
  it('--min-health fails (exit 1) when Health is below the threshold', async () => {
    const cap = capture();
    // 100 is unreachable for the fixture (it has SEO failures), so the gate trips.
    const code = await run({ cwd: fixtureDir, minHealth: 100, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).toBe(1);
  });

  it('--min-health passes (exit 0) when Health meets the threshold and no failing severity', async () => {
    const cap = capture();
    // 0 is always met; with default failOn=critical the fixture's criticals still gate,
    // so use a project-less assertion: a threshold of 0 must not be the cause of a failure.
    const code = await run({ cwd: fixtureDir, minHealth: 0, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    // The fixture has a critical SEO finding, so severity still gates to 1; min-health=0 does not add a failure.
    // Assert min-health=0 alone never forces 1 by comparing to the baseline (no minHealth).
    const baseline = await run({ cwd: fixtureDir, log: capture().log, errorLog: capture().errorLog, env: CLEAN_ENV });
    expect(code).toBe(baseline);
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

describe('run() config file (design doc 2026-07-05-config-file-design.md)', () => {
  it('reflects the config file in findings (SEO001 disabled by rules) and prints its warnings', async () => {
    const cap = capture();
    const code = await run({ cwd: configFileFixtureDir, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    // failOn: 'warning' (from the file) + a critical SEO002 finding present → exit 1.
    expect(code).toBe(1);
    const report = cap.out.join('\n');
    expect(report).not.toContain('SEO001');
    expect(report).toContain('SEO002');
  });

  it('exits 2 with the loader validation message for a config file with an unknown rule id', async () => {
    const cap = capture();
    const code = await run({ cwd: configFileInvalidFixtureDir, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).toBe(2);
    const errText = cap.err.join('\n');
    expect(errText).toContain('unknown rule id(s) in rules: NOPE999');
    expect(errText).toContain('Known rule ids:');
    // No double `svelte-vitals: ` prefix (the loader no longer prepends its own).
    expect(errText).not.toContain('svelte-vitals: svelte-vitals:');
  });
});

describe('run() --category', () => {
  it('restricts findings to the given category, excluding other categories', async () => {
    const cap = capture();
    await run({
      cwd: fixtureDir,
      reporter: 'json',
      log: cap.log,
      errorLog: cap.errorLog,
      categories: ['seo'],
      env: CLEAN_ENV
    });
    const json = JSON.parse(cap.out.join('\n'));
    expect(Object.keys(json.categories)).toEqual(['seo']);
    const allIds: string[] = [];
    for (const r of json.routes) for (const i of r.issues) allIds.push(i.id);
    expect(allIds.every((id: string) => id.startsWith('SEO'))).toBe(true);
    // PERF001 (missing <img> dimensions) is present without a category filter (see
    // 'run() performance rules' above); it must not survive a seo-only filter.
    expect(allIds).not.toContain('PERF001');
  });
});

describe('run() --score', () => {
  it('prints only the combined Health score as a single line', async () => {
    const cap = capture();
    const code = await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, score: true, env: CLEAN_ENV });
    expect(cap.out).toHaveLength(1);
    expect(cap.out[0]).toMatch(/^\d+$/);
    expect(code).toBe(1); // the fixture still has a critical SEO finding, so exit stays 1
  });

  it('gates on --min-health while suppressing reporter output (basic-project cannot reach 100)', async () => {
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      score: true,
      minHealth: 100,
      env: CLEAN_ENV
    });
    expect(code).toBe(1);
    expect(cap.out).toHaveLength(1);
    expect(cap.out[0]).toMatch(/^\d+$/);
  });
});

describe('run() --verbose and animation', () => {
  it('passes verbose:true through to the console report body', async () => {
    const cap = capture();
    await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      verbose: true
    });
    // basic-project's single critical finding still renders the same either way,
    // but verbose:true must not throw and must still produce console output.
    expect(cap.out.join('\n')).toContain('Critical');
  });

  it('animates the header on an interactive stdout and omits it from the printed body', async () => {
    const cap = capture();
    const animWrites: string[] = [];
    const stdoutStream = { write: (s: string) => animWrites.push(s) } as unknown as NodeJS.WriteStream;
    await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdoutIsTTY: true,
      stdoutStream,
      animationFrameDelayMs: 0
    });
    // Animation wrote frames to the injected stream...
    expect(animWrites.length).toBeGreaterThan(0);
    expect(animWrites.join('')).toContain('Health:');
    // ...and the printed report body has no duplicate header (Svelte Vitals brand line
    // and Health: line only ever came from the animation, not from formatConsoleReport).
    const report = cap.out.join('\n');
    expect(report).not.toContain('Svelte Vitals');
    expect(report).not.toContain('Health:');
    expect(report).toContain('Critical');
    // Category score lines are not animated — they must still print in the body,
    // right after the (animated, not printed-here) Health line.
    expect(report).toContain('SEO Score:');
  });

  it('does not animate when stdout is not a TTY — header prints inline as before', async () => {
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdoutIsTTY: false
    });
    expect(code).toBe(1);
    expect(cap.out.join('\n')).toContain('Health:');
  });

  it('--no-animation suppresses the animation even on an interactive stdout', async () => {
    const cap = capture();
    const animWrites: string[] = [];
    const stdoutStream = { write: (s: string) => animWrites.push(s) } as unknown as NodeJS.WriteStream;
    await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdoutIsTTY: true,
      stdoutStream,
      noAnimation: true
    });
    expect(animWrites).toEqual([]);
    expect(cap.out.join('\n')).toContain('Health:'); // header printed inline instead
  });
});
