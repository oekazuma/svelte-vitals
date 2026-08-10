// Built-dist gate-flag E2E (Phase 0 of the gunshi migration:
// docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md). Pins the exit codes the
// --fail-on/--min-health gates promise, against tiny fixture projects this script generates
// itself — never the shared packages/cli/test/fixtures, whose findings can drift as rules
// change. Follows scripts/floor-smoke.mjs's conventions (same runner, same hand-rolled
// node:assert style) but is wired into the `test` job (pnpm e2e, after floor-smoke), not
// `floor-smoke` — see AGENTS.md's floor-smoke section for why that job stays untouched.
//
//   node scripts/cli-e2e.mjs   (needs `pnpm build` first)

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const cliBin = join(root, 'packages/cli/dist/bin.js');

if (!existsSync(cliBin)) {
  console.error('cli-e2e: packages/cli/dist/bin.js is missing — run `pnpm build` first.');
  process.exit(1);
}

/**
 * Run the built CLI. Never throws: returns the exit code alongside the captured streams —
 * `execFileSync` only surfaces stdout on a zero exit (its return value) and both streams on a
 * non-zero one (via the thrown error), so a check needing stderr content from a *successful*
 * run (e.g. the auto-selected-reporter hint, which prints on exit 0) can't use it. `spawnSync`
 * captures both streams uniformly regardless of exit code.
 */
function runCli(args, opts = {}) {
  const result = spawnSync(process.execPath, [cliBin, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...opts
  });
  return {
    code: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

/**
 * The env vars gunshi/agent's bundled std-env actually checks for AI-agent detection
 * (read from node_modules/gunshi/lib/agent.js — gunshi has zero deps so std-env ships
 * inlined), plus our own SVELTE_VITALS_AGENT/SVELTE_VITALS_REPORTER and GITHUB_ACTIONS.
 * Stripped from the child's env before each reporter-auto-detection check below so the
 * outer process — itself often an AI-agent harness — can't leak a false positive in.
 */
/**
 * Child-process env built from an ALLOWLIST, not by scrubbing known agent signals: gunshi/std-env's
 * detection list grows upstream, and a deny list would silently fall behind it — a newly recognized
 * variable inherited from the parent env could flip the clean-env check. Only what Node needs to
 * spawn survives, so any detection signal must come from an explicit per-check override.
 */
const CHILD_ENV_ALLOWLIST = ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'SYSTEMROOT', 'NODE_OPTIONS'];

function cleanEnv(overrides = {}) {
  const env = {};
  for (const key of CHILD_ENV_ALLOWLIST) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return { ...env, ...overrides };
}

const PACKAGE_JSON = JSON.stringify({
  name: 'cli-e2e-fixture',
  private: true,
  type: 'module',
  devDependencies: { '@sveltejs/kit': '^2.0.0', svelte: '^5.0.0' }
});

/**
 * `@sveltejs/kit` in package.json is enough for detectProject — an empty (or absent)
 * src/routes is not an error, and zero routes means zero results, which computeHealth
 * treats as a perfect 100 (see packages/core/src/scoring/score.ts). The most future-proof
 * "clean" fixture: no rule can ever find anything to flag in a project with no files.
 */
function makeCleanProject() {
  const dir = mkdtempSync(join(tmpdir(), 'cli-e2e-clean-'));
  writeFileSync(join(dir, 'package.json'), PACKAGE_JSON);
  return dir;
}

/**
 * A title-only page. `seo/title-presence` is the only 'critical' SEO rule (verified against
 * packages/core/src/rules/**\/*.ts: the only other critical rules are correctness/security
 * checks for `$effect`/lifecycle/`window`/`document` misuse and event-handler state writes,
 * none of which this markup can trigger), so this satisfies it and nothing else — every other
 * SEO presence rule (description, canonical, og:*, ...) is 'warning', so at least one warning
 * finding is guaranteed. Imperfect by construction: health is under 100, and there is no
 * critical finding, so the default gate (--fail-on critical) passes while --fail-on warning
 * and --min-health 100 both fail.
 */
function makeWarningOnlyProject() {
  const dir = mkdtempSync(join(tmpdir(), 'cli-e2e-warning-'));
  writeFileSync(join(dir, 'package.json'), PACKAGE_JSON);
  mkdirSync(join(dir, 'src/routes'), { recursive: true });
  writeFileSync(
    join(dir, 'src/routes/+page.svelte'),
    '<svelte:head>\n  <title>Home</title>\n</svelte:head>\n\n<h1>Home</h1>\n'
  );
  return dir;
}

const checks = [];
function check(name, fn) {
  checks.push([name, fn]);
}

check('a clean project (no routes) exits 0 under the default gate', () => {
  const dir = makeCleanProject();
  try {
    const args = [dir];
    const { code, signal, stderr } = runCli(args);
    assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
    assert.equal(code, 0, `\`svelte-vitals ${args.join(' ')}\` expected exit 0, got ${code}: ${stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check('a warning-only project exits 0 under the default gate (fail-on critical)', () => {
  const dir = makeWarningOnlyProject();
  try {
    const args = [dir];
    const { code, signal, stderr } = runCli(args);
    assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
    assert.equal(code, 0, `\`svelte-vitals ${args.join(' ')}\` expected exit 0, got ${code}: ${stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check('the same project exits 1 under --fail-on warning', () => {
  const dir = makeWarningOnlyProject();
  try {
    const args = [dir, '--fail-on', 'warning'];
    const { code, signal, stderr } = runCli(args);
    assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
    assert.equal(code, 1, `\`svelte-vitals ${args.join(' ')}\` expected exit 1, got ${code}: ${stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check('--min-health 100 fails on an imperfect project', () => {
  const dir = makeWarningOnlyProject();
  try {
    const args = [dir, '--min-health', '100'];
    const { code, signal, stderr } = runCli(args);
    assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
    assert.equal(code, 1, `\`svelte-vitals ${args.join(' ')}\` expected exit 1, got ${code}: ${stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check('a non-project directory exits 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-e2e-nonproject-'));
  try {
    const args = [dir];
    const { code, signal, stderr } = runCli(args);
    assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
    assert.equal(code, 2, `\`svelte-vitals ${args.join(' ')}\` expected exit 2, got ${code}: ${stderr}`);
    assert.match(stderr, /No SvelteKit project found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check('--help exits 0', () => {
  const { code, signal, stdout, stderr } = runCli(['--help']);
  assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
  assert.equal(code, 0, `\`svelte-vitals --help\` expected exit 0, got ${code}: ${stderr}`);
  assert.match(stdout, /svelte-vitals — a deterministic SvelteKit code-health scanner/);
});

check('--reporter json stdout parses as JSON when findings exist', () => {
  const dir = makeWarningOnlyProject();
  try {
    const args = [dir, '--reporter', 'json'];
    const { code, signal, stdout, stderr } = runCli(args);
    assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
    assert.equal(code, 0, `\`svelte-vitals ${args.join(' ')}\` expected exit 0, got ${code}: ${stderr}`);
    const report = JSON.parse(stdout);
    assert.equal(typeof report.score, 'number');
    assert.ok(report.score < 100, `expected an imperfect score, got ${report.score}`);
    assert.ok(report.categories && typeof report.categories === 'object');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Real end-to-end coverage for the gunshi/agent → std-env delegation (reporter-resolve.ts's
 * isAgentEnv): unlike a vitest unit test, gunshi is a real node_modules dependency whose agent
 * profile is computed once when the module is first imported and cached from then on — vitest's
 * module-registry reset doesn't bust that for externalized deps, so no in-process env stub can
 * exercise it. A fresh child process has no such cache: each check below gets its own process,
 * so std-env's own env read sees exactly the env set up for it.
 */
check('a clean env (no agent signal) falls back to console output, not the agent reporter', () => {
  const dir = makeWarningOnlyProject();
  try {
    const { code, signal, stdout, stderr } = runCli([dir], { env: cleanEnv() });
    assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
    assert.equal(code, 0, `expected exit 0, got ${code}: ${stderr}`);
    assert.doesNotMatch(stderr, /agent reporter auto-selected/);
    assert.doesNotMatch(stdout, /# svelte-vitals — fixes/); // agent reporter's Markdown header
    assert.match(stdout, /Svelte Vitals {2}·/); // console reporter's own header
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check('CLAUDECODE (gunshi/std-env-recognized) auto-selects the agent reporter', () => {
  const dir = makeWarningOnlyProject();
  try {
    const { code, signal, stdout, stderr } = runCli([dir], { env: cleanEnv({ CLAUDECODE: '1' }) });
    assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
    assert.equal(code, 0, `expected exit 0, got ${code}: ${stderr}`);
    assert.match(stderr, /agent reporter auto-selected/);
    assert.match(stdout, /# svelte-vitals — fixes/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check('CURSOR_AGENT (a non-Claude gunshi/std-env-recognized var) auto-selects the agent reporter', () => {
  const dir = makeWarningOnlyProject();
  try {
    const { code, signal, stdout, stderr } = runCli([dir], { env: cleanEnv({ CURSOR_AGENT: '1' }) });
    assert.equal(signal, null, `killed by signal ${signal} (stderr: ${stderr})`);
    assert.equal(code, 0, `expected exit 0, got ${code}: ${stderr}`);
    assert.match(stderr, /agent reporter auto-selected/);
    assert.match(stdout, /# svelte-vitals — fixes/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

let failed = 0;
for (const [name, fn] of checks) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}\n       ${err.stack ?? err.message}`);
  }
}

if (failed > 0) {
  console.error(`cli-e2e: ${failed} of ${checks.length} checks failed`);
  process.exit(1);
}
console.log(`cli-e2e: ${checks.length} checks passed`);
