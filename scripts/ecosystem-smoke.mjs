// Ecosystem smoke (design doc: docs/superpowers/specs/2026-08-16-ecosystem-smoke-design.md).
//
// Runs the BUILT `dist` against real third-party SvelteKit apps and asserts only that it did not
// fall over: exit 0 or 1, and a JSON report that parses. Never a score, never a count — those move
// with every release by design, and asserting them would turn this into a job people mute.
//
//   node scripts/ecosystem-smoke.mjs [--keep]
//
// Node builtins plus `git`, like floor-smoke.mjs: no dev dependency may leak in here.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The corpus tracks each repo's default branch on purpose: the value is that upstream keeps
 * writing Svelte we did not anticipate. Reproducibility is paid for by printing the SHA below.
 * `path` is the SvelteKit app inside the repo, '.' when the repo is the app.
 */
const CORPUS = [
  { repo: 'sveltejs/svelte.dev', path: 'apps/svelte.dev' },
  { repo: 'huntabyte/shadcn-svelte', path: 'docs' },
  { repo: 'imputnet/cobalt', path: 'web' },
  { repo: 'seanmorley15/AdventureLog', path: 'frontend' },
  { repo: 'rajnandan1/kener', path: '.' },
  { repo: 'lissy93/networking-toolbox', path: '.' },
  { repo: 'matiadev/joy-of-code', path: '.' },
  { repo: 'scosman/CMSaasStarter', path: '.' }
];

// Kept small enough that eight targets at their worst still land inside the workflow's own
// timeout, so a bad week produces this script's per-target report rather than GitHub's mid-run kill.
const ANALYZE_TIMEOUT_MS = 60_000;
const CLONE_TIMEOUT_MS = 120_000;

const STDOUT_CAP_MB = 64;

const root = join(import.meta.dirname, '..');
const cliBin = join(root, 'packages/cli/dist/bin.js');

if (!existsSync(cliBin)) {
  console.error('ecosystem-smoke: packages/cli/dist/bin.js is missing — run `pnpm build` first.');
  process.exit(1);
}

/**
 * The CLI dynamically imports a config file from the directory it analyzes, so cloning arbitrary
 * repos would execute their code here the moment one of them adopts svelte-vitals. Deleting it is
 * also what this job wants: every target measured under default config.
 */
function dropConfigFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('svelte-vitals.config.')) unlinkSync(join(dir, name));
  }
}

/** Never throws: returns the exit code alongside the captured streams. */
function analyze(dir) {
  try {
    // `--no-suppressions` because a target's own recorded suppressions would silently hide
    // findings, and a suppressions file from a future format version is a hard exit 2 — which is
    // the code this job reads as an engine crash.
    const stdout = execFileSync(process.execPath, [cliBin, dir, '--reporter', 'json', '--no-suppressions'], {
      encoding: 'utf8',
      timeout: ANALYZE_TIMEOUT_MS,
      maxBuffer: STDOUT_CAP_MB * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, stdout, stderr: '', signal: null };
  } catch (e) {
    return { code: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '', signal: e.signal ?? null };
  }
}

/** Clone, or return git's own first line of stderr — "Command failed: git clone" explains nothing. */
function clone(repo, dir) {
  try {
    execFileSync('git', ['clone', '--depth', '1', `https://github.com/${repo}.git`, dir], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: CLONE_TIMEOUT_MS
    });
    return undefined;
  } catch (e) {
    const reason = String(e.stderr ?? '')
      .split('\n')
      .find((l) => l.trim().length > 0);
    return `clone failed: ${reason ?? e.message.split('\n')[0]}`;
  }
}

function check({ repo, path }, workdir) {
  const dir = join(workdir, repo.replace('/', '__'));
  const cloneError = clone(repo, dir);
  if (cloneError) return { sha: 'unknown', error: cloneError };
  const sha = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  const target = path === '.' ? dir : join(dir, path);
  if (!existsSync(target))
    return { sha, error: `${path} does not exist in the clone — has the repo been restructured?` };
  dropConfigFiles(target);

  const { code, stdout, stderr, signal } = analyze(target);
  // A signal is a timeout, a maxBuffer overrun, or the kernel killing it — all failures, but the
  // cause is not knowable from here, so do not name one.
  if (signal !== null) {
    return { sha, error: `killed by ${signal} (timeout ${ANALYZE_TIMEOUT_MS}ms, stdout cap ${STDOUT_CAP_MB}MB)` };
  }
  // 2 is the CLI's "not a SvelteKit project / internal error" — every target is known to be one,
  // so 2 is exactly the failure this job exists to catch.
  if (code !== 0 && code !== 1)
    return { sha, error: `exit ${code}: ${stderr.trim().split('\n').slice(0, 6).join(' | ')}` };

  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return { sha, error: `exit ${code} but stdout is not JSON: ${stdout.slice(0, 200)}` };
  }
  if (
    typeof report.score !== 'number' ||
    !Array.isArray(report.routes) ||
    report.rules === null ||
    typeof report.rules !== 'object'
  ) {
    return { sha, error: 'JSON parsed but is not a report (missing score/routes/rules)' };
  }
  return { sha, code, routes: report.routes.length, rules: Object.keys(report.rules).length };
}

const workdir = mkdtempSync(join(tmpdir(), 'svelte-vitals-ecosystem-'));
const failures = [];
try {
  for (const target of CORPUS) {
    const label = target.path === '.' ? target.repo : `${target.repo}/${target.path}`;
    let result;
    try {
      result = check(target, workdir);
    } catch (e) {
      result = { sha: 'unknown', error: String(e.message).split('\n')[0] };
    }
    if (result.error) {
      console.error(`FAIL  ${label} @ ${result.sha}\n      ${result.error}`);
      failures.push(label);
    } else {
      console.log(
        `ok    ${label} @ ${result.sha} — exit ${result.code}, ${result.routes} routes, ${result.rules} rules`
      );
    }
  }
} finally {
  if (!process.argv.includes('--keep')) rmSync(workdir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} of ${CORPUS.length} targets failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`\nall ${CORPUS.length} targets analyzed without falling over`);
