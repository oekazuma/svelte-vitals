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
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

const checks = [];
function check(name, fn) {
  checks.push([name, fn]);
}

check('--version prints the CLI and core versions and exits 0', () => {
  const { code, signal, stdout, stderr } = runCli(['--version']);
  assert.equal(signal, null, `killed by signal ${signal}, not a normal exit (stderr: ${stderr})`);
  assert.equal(code, 0, `expected exit 0, got ${code}: ${stderr}`);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+(-[\w.]+)? \(core \d+\.\d+\.\d+(-[\w.]+)?\)$/);
});

check('a directory that is not a SvelteKit project exits 2', () => {
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

check('analysing a real project emits a well-formed JSON report', () => {
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

check('the read-only subcommands deliver complete JSON through a pipe', () => {
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

check('the analysis report survives a real shell pipe', () => {
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

check('a bad subcommand argument exits 2 with an empty stdout', () => {
  // The exit-2 contract the docs subcommand promises, asserted on the real process rather
  // than on the in-process handler.
  const { code, stdout, stderr } = runCli(['docs', 'show', 'no-such-topic']);
  assert.equal(code, 2, `expected exit 2, got ${code}`);
  assert.equal(stdout, '', `expected empty stdout, got ${JSON.stringify(stdout.slice(0, 80))}`);
  assert.match(stderr, /unknown docs topic/);
});

check('every published entry point imports under bare node', async () => {
  for (const entry of [
    'packages/core/dist/index.js',
    'packages/cli/dist/index.js',
    'packages/vite/dist/index.js',
    'packages/vite/dist/hooks/index.js'
  ]) {
    const mod = await import(join(root, entry));
    assert.ok(Object.keys(mod).length > 0, `${entry} exported nothing`);
  }
});

/**
 * Whether this Node strips TypeScript types from `import()` without a flag:
 * unflagged in 23.6.0, backported to 22.18.0. The floor (22.13.0) is inside the
 * window that needs `--experimental-strip-types`, so this decides which side of
 * the `.ts` config contract to assert.
 */
function supportsUnflaggedTypeStripping() {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  return (major === 22 && minor >= 18) || (major === 23 && minor >= 6) || major >= 24;
}

check("a .ts config file matches this Node runtime's type-stripping support", () => {
  // `loadConfigFile` runs before project detection, so on the floor Node the config
  // throws whatever this directory holds. It has to look like a SvelteKit app for the
  // other branch: there the config loads and execution continues into detection, which
  // must succeed to reach a report.
  const project = mkdtempSync(join(tmpdir(), 'floor-smoke-ts-'));
  try {
    cpSync(basicProject, project, { recursive: true });
    cpSync(join(fixtures, 'config-file-ts/svelte-vitals.config.ts'), join(project, 'svelte-vitals.config.ts'));

    const { code, signal, stderr } = runCli([project, '--reporter', 'json']);
    assert.equal(signal, null, `killed by signal ${signal}, not a normal exit (stderr: ${stderr})`);
    if (supportsUnflaggedTypeStripping()) {
      assert.ok(code === 0 || code === 1, `expected the .ts config to load, got exit ${code}: ${stderr}`);
    } else {
      // The floor's contract: loadConfigFile turns Node's raw
      // ERR_UNKNOWN_FILE_EXTENSION into an actionable message. vitest can never
      // reach this branch — its module runner transforms in-process `import()`.
      assert.equal(code, 2, `expected exit 2, got ${code}: ${stderr}`);
      assert.match(stderr, /does not support TypeScript config files without a flag/);
      assert.match(stderr, /22\.18\+/);
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

console.log(
  `floor-smoke: node ${process.versions.node} (unflagged type stripping: ${supportsUnflaggedTypeStripping()})`
);

let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}\n       ${err.stack ?? err.message}`);
  }
}

if (failed > 0) {
  console.error(`floor-smoke: ${failed} of ${checks.length} checks failed`);
  process.exit(1);
}
console.log(`floor-smoke: ${checks.length} checks passed`);
