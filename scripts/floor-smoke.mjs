// End-user Node floor smoke (design doc:
// docs/superpowers/specs/2026-07-31-floor-smoke-design.md).
//
// Runs the BUILT `dist` of the published packages under a bare `node` — never
// through vitest. CI pins this to the `engines.node` floor (22.13.0), which is
// the version no dev dependency is held to any more; `pnpm test` covers the
// release lines the dev toolchain supports instead.
//
//   node scripts/floor-smoke.mjs
//
// Assertions are hand-rolled against `node:assert`: pulling in a test runner
// would put the dev toolchain back on the floor, which is the whole point.

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const cliBin = join(root, 'packages/cli/dist/bin.js');
const basicProject = join(root, 'packages/cli/test/fixtures/basic-project');

/** Run the built CLI. Never throws: returns the exit code alongside the captured streams. */
function runCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [cliBin, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      ...opts
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.status ?? 1, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? '') };
  }
}

const checks = [];
function check(name, fn) {
  checks.push([name, fn]);
}

check('--version prints the CLI and core versions and exits 0', () => {
  const { code, stdout } = runCli(['--version']);
  assert.equal(code, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+ \(core \d+\.\d+\.\d+\)$/);
});

check('a directory that is not a SvelteKit project exits 2', () => {
  const empty = mkdtempSync(join(tmpdir(), 'floor-smoke-empty-'));
  const { code, stderr } = runCli([empty]);
  assert.equal(code, 2);
  assert.match(stderr, /No SvelteKit project found/);
});

check('analysing a real project emits a well-formed JSON report', () => {
  const { code, stdout } = runCli([basicProject, '--reporter', 'json']);
  // 0 (clean) and 1 (a finding reached the fail threshold) are both contractual;
  // asserting the score would make this smoke a hostage of the rule set.
  assert.ok(code === 0 || code === 1, `expected exit 0 or 1, got ${code}`);
  const report = JSON.parse(stdout);
  assert.equal(typeof report.version, 'string');
  assert.equal(typeof report.score, 'number');
  assert.ok(report.categories && typeof report.categories === 'object');
});

check('every published entry point imports under bare node', async () => {
  for (const entry of [
    'packages/core/dist/index.js',
    'packages/cli/dist/index.js',
    'packages/vite/dist/index.js',
    'packages/vite/dist/hooks/index.js',
    'packages/mcp/dist/index.js'
  ]) {
    const mod = await import(join(root, entry));
    assert.ok(Object.keys(mod).length > 0, `${entry} exported nothing`);
  }
});

console.log(`floor-smoke: node ${process.versions.node}`);

let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`floor-smoke: ${failed} of ${checks.length} checks failed`);
  process.exit(1);
}
console.log(`floor-smoke: ${checks.length} checks passed`);
