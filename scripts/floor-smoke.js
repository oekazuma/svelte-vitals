// End-user Node floor smoke (design doc:
// docs/superpowers/specs/2026-07-31-floor-smoke-design.md).
//
// Runs the BUILT `dist` of the published packages under a bare `node` — never
// through vitest. CI pins this to the `engines.node` floor (24.16.0), which is
// the version no dev dependency is held to any more; `pnpm test` covers the
// release lines the dev toolchain supports instead.
//
//   node scripts/floor-smoke.js
//
// The runner is `node:test` — built into the floor Node, so no dev dependency
// is put back on the floor. Executing this file directly runs the tests and
// exits non-zero on failure, so the `node scripts/floor-smoke.js` contract
// (CI and `pnpm smoke`) is unchanged.

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..');
const cliBin = join(root, 'packages/cli/dist/bin.js');
const fixtures = join(root, 'packages/cli/test/fixtures');
const basicProject = join(fixtures, 'basic-project');

if (!existsSync(cliBin)) {
  console.error('floor-smoke: packages/cli/dist/bin.js is missing — run `pnpm build` first.');
  process.exit(1);
}

/**
 * Run the built CLI. Never throws: returns the exit code alongside the captured streams.
 * A signal kill (status === null) is surfaced as its own field rather than folded into
 * `code`, so callers can't mistake it for a normal exit 1.
 */
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

console.log(`floor-smoke: node ${process.versions.node}`);

test('--version prints the CLI and core versions and exits 0', () => {
  const { code, signal, stdout, stderr } = runCli(['--version']);
  assert.equal(signal, null, `killed by signal ${signal}, not a normal exit (stderr: ${stderr})`);
  assert.equal(code, 0, `expected exit 0, got ${code}: ${stderr}`);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+(-[\w.]+)? \(core \d+\.\d+\.\d+(-[\w.]+)?\)$/);
});

test('a directory that is not a SvelteKit project exits 2', () => {
  const empty = mkdtempSync(join(tmpdir(), 'floor-smoke-empty-'));
  try {
    const { code, signal, stderr } = runCli([empty]);
    assert.equal(signal, null, `killed by signal ${signal}, not a normal exit (stderr: ${stderr})`);
    assert.equal(code, 2, `expected exit 2, got ${code}: ${stderr}`);
    assert.match(stderr, /No SvelteKit project found/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test('analysing a real project emits a well-formed JSON report', () => {
  const { code, signal, stdout, stderr } = runCli([basicProject, '--reporter', 'json']);
  assert.equal(signal, null, `killed by signal ${signal}, not a normal exit (stderr: ${stderr})`);
  // 0 (clean) and 1 (a finding reached the fail threshold) are both contractual;
  // asserting the score would make this smoke a hostage of the rule set.
  assert.ok(code === 0 || code === 1, `expected exit 0 or 1, got ${code}: ${stderr}`);
  const report = JSON.parse(stdout);
  assert.equal(typeof report.version, 'string');
  assert.equal(typeof report.score, 'number');
  assert.ok(report.categories && typeof report.categories === 'object');
});

test('the read-only subcommands deliver complete JSON through a pipe', () => {
  // execFileSync gives the child a pipe, not a TTY — the case where `process.exit` can drop
  // undrained writes. Parsing the whole payload is what proves nothing was truncated.
  for (const [args, check] of [
    [['docs', 'list', '--json'], (v) => v.every((d) => d.name && d.description)],
    [['explain', '--list', '--json'], (v) => v.every((r) => r.id && r.category)]
  ]) {
    const { code, signal, stdout, stderr } = runCli(args);
    assert.equal(signal, null, `${args.join(' ')} killed by signal ${signal}`);
    assert.equal(code, 0, `${args.join(' ')} exited ${code}: ${stderr}`);
    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed) && parsed.length > 0, `${args.join(' ')} returned no entries`);
    assert.ok(check(parsed), `${args.join(' ')} returned an incomplete entry`);
  }
});

test('the analysis report survives a real shell pipe', () => {
  // `runCli` and the sibling checks give the child a socketpair, whose buffer is wide enough on Linux to
  // hide a truncation; `sh -c '… | cat'` gives it a 65,536-byte FIFO, which is what a user piping to `jq`
  // gets. Positional parameters rather than interpolation, so a checkout path containing a space survives.
  // Payload integrity only: a pipeline's exit status is `cat`'s, so the CLI's 0/1/2 contract is unassertable
  // here and stays with the checks above.
  const stdout = execFileSync(
    'sh',
    ['-c', '"$1" "$2" "$3" --reporter json | cat', 'sh', process.execPath, cliBin, basicProject],
    {
      encoding: 'utf8',
      // stderr inherited, not ignored: a clean `--reporter json` run writes nothing there, and when the
      // fixture is broken the CLI's own reason beats a JSON parse error as the thing the smoke prints.
      stdio: ['ignore', 'pipe', 'inherit']
    }
  );
  const report = JSON.parse(stdout);
  assert.equal(typeof report.version, 'string');
  assert.equal(typeof report.score, 'number');
});

test('a bad subcommand argument exits 2 with an empty stdout', () => {
  // The exit-2 contract the docs subcommand promises, asserted on the real process rather
  // than on the in-process handler.
  const { code, stdout, stderr } = runCli(['docs', 'show', 'no-such-topic']);
  assert.equal(code, 2, `expected exit 2, got ${code}`);
  assert.equal(stdout, '', `expected empty stdout, got ${JSON.stringify(stdout.slice(0, 80))}`);
  assert.match(stderr, /unknown docs topic/);
});

test('every published entry point imports under bare node', async () => {
  for (const entry of [
    'packages/core/dist/index.js',
    'packages/core/dist/internal.js',
    'packages/cli/dist/index.js',
    'packages/vite/dist/index.js',
    'packages/vite/dist/hooks/index.js'
  ]) {
    const mod = await import(join(root, entry));
    assert.ok(Object.keys(mod).length > 0, `${entry} exported nothing`);
  }
});

test('a .js config in an explicit-CommonJS project fails with the guided ESM error', () => {
  // Only a bare `node` can pin this: vitest's module runner transforms in-process
  // `import()`, so the raw CJS SyntaxError never surfaces there.
  const project = mkdtempSync(join(tmpdir(), 'floor-smoke-cjs-'));
  try {
    cpSync(basicProject, project, { recursive: true });
    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify({ name: 'cjs-fixture', private: true, type: 'commonjs' })
    );
    writeFileSync(join(project, 'svelte-vitals.config.js'), 'export default {};\n');

    const { code, signal, stderr } = runCli([project, '--reporter', 'json']);
    assert.equal(signal, null, `killed by signal ${signal}, not a normal exit (stderr: ${stderr})`);
    assert.equal(code, 2, `expected exit 2, got ${code}: ${stderr}`);
    assert.match(stderr, /config files are ESM/);
    assert.match(stderr, /svelte-vitals\.config\.js/);
    // Node's own SyntaxError text has to survive: the same branch catches a typo in a valid
    // ESM config, which is undiagnosable without it.
    assert.match(stderr, /Unexpected token/);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test('a leftover svelte-vitals.config.mjs fails loudly instead of silently using defaults', () => {
  const project = mkdtempSync(join(tmpdir(), 'floor-smoke-mjs-'));
  try {
    cpSync(basicProject, project, { recursive: true });
    writeFileSync(join(project, 'svelte-vitals.config.mjs'), 'export default {};\n');

    const { code, signal, stderr } = runCli([project, '--reporter', 'json']);
    assert.equal(signal, null, `killed by signal ${signal}, not a normal exit (stderr: ${stderr})`);
    assert.equal(code, 2, `expected exit 2, got ${code}: ${stderr}`);
    assert.match(stderr, /no longer read/);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test('a .ts config file loads under bare node (native type stripping)', () => {
  // vitest can never pin this — its module runner transforms in-process `import()` —
  // so the raw-Node behaviour lives here. The directory has to look like a SvelteKit
  // app: the config loads first, then execution continues into detection, which must
  // succeed to reach a report.
  const project = mkdtempSync(join(tmpdir(), 'floor-smoke-ts-'));
  try {
    cpSync(basicProject, project, { recursive: true });
    cpSync(join(fixtures, 'config-file-ts/svelte-vitals.config.ts'), join(project, 'svelte-vitals.config.ts'));

    const { code, signal, stderr } = runCli([project, '--reporter', 'json']);
    assert.equal(signal, null, `killed by signal ${signal}, not a normal exit (stderr: ${stderr})`);
    assert.ok(code === 0 || code === 1, `expected the .ts config to load, got exit ${code}: ${stderr}`);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
