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
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const cliBin = join(root, 'packages/cli/dist/bin.js');

if (!existsSync(cliBin)) {
  console.error('cli-e2e: packages/cli/dist/bin.js is missing — run `pnpm build` first.');
  process.exit(1);
}

/** Run the built CLI. Never throws: returns the exit code alongside the captured streams. */
function runCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [cliBin, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      ...opts
    });
    return { code: 0, signal: null, stdout, stderr: '' };
  } catch (err) {
    return {
      code: err.status,
      signal: err.signal ?? null,
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? '')
    };
  }
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
