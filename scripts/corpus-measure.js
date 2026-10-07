// Corpus precision (design doc: docs/superpowers/specs/2026-09-23-corpus-precision-design.md).
//
// Measures every rule's findings on real third-party SvelteKit apps pinned in scripts/corpus/targets.json
// and joins them with the human verdicts in scripts/corpus/verdicts/. Reports; never gates.
//
//   node scripts/corpus-measure.js run [--cli <bin.js>] [--cache <dir>] [--targets <file>] [--jobs <n>] --out <file>
//   node scripts/corpus-measure.js diff <before.json> <after.json> [--measurement <file>] [--base-verdicts <dir>]
//   node scripts/corpus-measure.js update [--cache <dir>] [--jobs <n>]
//   node scripts/corpus-measure.js fetch [--cache <dir>] [--jobs <n>]
//
// Node builtins plus `git`, like ecosystem-smoke.js: no dev dependency may leak in here.

import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import {
  VERDICTS,
  appId,
  digest,
  readVerdicts,
  reportPath,
  renderBlock,
  replaceBlock
} from '../packages/cli/scripts/rule-reliability.js';

const ANALYZE_TIMEOUT_MS = 180_000;
const CLONE_TIMEOUT_MS = 300_000;
// A fetch from GitHub times out now and then; one retry keeps a flake from failing the gate.
const FETCH_ATTEMPTS = 2;
const STDOUT_CAP_MB = 64;
const LIST_CAP = 20;

const root = join(import.meta.dirname, '..');
const corpusDir = join(root, 'scripts/corpus');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
// `--targets` swaps in another pinned list (the v1 holdout) for `run`; everything else uses the corpus.
let targets = readJson(join(corpusDir, 'targets.json'));
const verdictsDir = join(corpusDir, 'verdicts');
const measurementFile = join(corpusDir, 'measurement.json');

/**
 * One reading of the code decides a finding, so the route is not part of the key: a component
 * finding repeats on every route that renders it. Findings with no line fall back to the file,
 * with no file to the route (e.g. "Missing <h1>"), and site-level findings to `(site)`. The claim
 * (the title, counts masked so "Multiple <h1> (19)" survives an unrelated count change) is part of
 * the key: a rule that starts saying something else at the same place must not inherit the verdict
 * given to what it said before.
 */
function findingKey(app, issue, route) {
  const locus = issue.location
    ? issue.line != null
      ? `${issue.location}:${issue.line}`
      : issue.location
    : (route ?? '(site)');
  return `${app}::${issue.id}::${locus}::${String(issue.title).replace(/\d+/g, '#')}`;
}

/** A rule that throws is skipped with a stderr warning while the report still parses; its findings would read as removed. */
const FAILED_RULE = /\brule (\S+) failed and was skipped\b/g;

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

/** Never rejects: resolves with the exit code alongside the captured streams. */
function analyze(cli, dir) {
  // `--no-suppressions` because a target's own recorded suppressions would silently hide
  // findings, and a suppressions file from a future format version is a hard exit 2.
  return new Promise((done) => {
    const child = spawn(process.execPath, [cli, dir, '--reporter', 'json', '--no-suppressions'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: ANALYZE_TIMEOUT_MS
    });
    // Each stream is capped like `maxBuffer`: past it the child is killed and reported as such.
    const capture = (stream) => {
      const chunks = [];
      let size = 0;
      stream.on('data', (chunk) => {
        size += chunk.length;
        if (size > STDOUT_CAP_MB * 1024 * 1024) child.kill('SIGTERM');
        else chunks.push(chunk);
      });
      return chunks;
    };
    const out = capture(child.stdout);
    const err = capture(child.stderr);
    child.on('error', (e) => done({ code: null, stdout: '', stderr: String(e), signal: null }));
    child.on('close', (code, signal) =>
      done({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), signal })
    );
  });
}

const execFileAsync = promisify(execFile);

async function git(args, opts = {}) {
  const { stdout } = await execFileAsync('git', args, { encoding: 'utf8', ...opts });
  return stdout.trim();
}

/** Clone-by-SHA into `dir` (or move an existing clone to the SHA); resolves with an error string or undefined. */
async function checkoutPinned({ repo, sha }, dir) {
  // Without its own `.git`, `git -C` would walk up and fetch into whatever repo encloses the cache.
  if (!existsSync(join(dir, '.git'))) {
    if (existsSync(dir)) return `${dir} exists but is not a git clone`;
    mkdirSync(dir, { recursive: true });
    await git(['init', '--quiet', dir]);
  } else {
    try {
      if ((await git(['-C', dir, 'rev-parse', 'HEAD'])) === sha) return undefined;
    } catch {
      // a clone whose first fetch failed has no HEAD yet
    }
  }
  let failure;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      await git(['-C', dir, 'fetch', '--quiet', '--depth', '1', `https://github.com/${repo}.git`, sha], {
        timeout: CLONE_TIMEOUT_MS
      });
      await git(['-C', dir, 'checkout', '--quiet', '--force', '--detach', 'FETCH_HEAD']);
      return undefined;
    } catch (e) {
      const reason = String(e.stderr ?? '')
        .split('\n')
        .find((l) => l.trim().length > 0);
      failure = `fetch ${sha} failed: ${reason ?? e.message.split('\n')[0]}`;
      if (attempt < FETCH_ATTEMPTS) await sleep(5_000);
    }
  }
  return failure;
}

function findingsOf(app, report) {
  const byKey = new Map();
  const add = (issue, route) => {
    const key = findingKey(app, issue, route);
    const id = `${key}\0${issue.severity}\0${issue.title}`;
    const seen = byKey.get(id);
    if (seen) seen.routes++;
    else
      byKey.set(id, {
        key,
        rule: issue.id,
        severity: issue.severity,
        route: route ?? null,
        routes: route ? 1 : 0,
        location: issue.location ?? null,
        line: issue.line ?? null,
        title: issue.title
      });
  };
  for (const { route, issues } of report.routes) for (const issue of issues) add(issue, route);
  for (const issue of report.siteIssues ?? []) add(issue, undefined);
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

async function measureTarget(target, cli, cache) {
  const app = appId(target);
  const dir = join(cache, target.repo.replace('/', '__'));
  const error = await checkoutPinned(target, dir);
  if (error) return { app, sha: target.sha, error };

  const path = target.path === '.' ? dir : join(dir, target.path);
  if (!existsSync(path)) return { app, sha: target.sha, error: `${target.path} does not exist at ${target.sha}` };
  // A repo is free to commit a symlink, and `dropConfigFiles` would then unlink through it,
  // outside the clone entirely.
  const cloneRoot = realpathSync(dir);
  const real = realpathSync(path);
  if (real !== cloneRoot && !real.startsWith(cloneRoot + sep)) {
    return {
      app,
      sha: target.sha,
      error: `${target.path} resolves outside the clone (${real}) — refusing to touch it`
    };
  }
  dropConfigFiles(real);

  const { code, stdout, stderr, signal } = await analyze(cli, real);
  if (signal !== null)
    return {
      app,
      sha: target.sha,
      error: `killed by ${signal} (timeout ${ANALYZE_TIMEOUT_MS}ms, stdout cap ${STDOUT_CAP_MB}MB)`
    };
  if (code !== 0 && code !== 1)
    return { app, sha: target.sha, error: `exit ${code}: ${stderr.trim().split('\n').slice(0, 6).join(' | ')}` };
  const failedRules = [...stderr.matchAll(FAILED_RULE)].map((m) => m[1]);
  if (failedRules.length > 0) return { app, sha: target.sha, error: `rule(s) crashed: ${failedRules.join(', ')}` };
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return { app, sha: target.sha, error: `exit ${code} but stdout is not JSON: ${stdout.slice(0, 200)}` };
  }
  return { app, sha: target.sha, exit: code, version: report.version, findings: findingsOf(app, report) };
}

/**
 * Calls `each` on every target index, `jobs` repositories at a time. Targets that share a repository
 * share its clone, so they run one after another in the same worker.
 */
async function forEachTarget(jobs, each) {
  const byRepo = new Map();
  targets.forEach((t, i) => byRepo.set(t.repo, [...(byRepo.get(t.repo) ?? []), i]));
  const queue = [...byRepo.values()];
  const worker = async () => {
    for (let group = queue.shift(); group; group = queue.shift()) for (const i of group) await each(i);
  };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
}

/** `apps` keeps the order of `targets`. */
async function run({ cli, cache, jobs }) {
  if (!existsSync(cli)) throw new Error(`${cli} is missing — run \`pnpm build\` first.`);
  const apps = new Array(targets.length);
  await forEachTarget(jobs, async (i) => {
    const started = Date.now();
    const result = await measureTarget(targets[i], cli, cache);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (result.error) console.error(`FAIL  ${result.app} (${seconds}s): ${result.error}`);
    else {
      const distinct = new Set(result.findings.map((f) => f.key)).size;
      console.error(`ok    ${result.app} — exit ${result.exit}, ${distinct} distinct findings (${seconds}s)`);
    }
    apps[i] = result;
  });
  return { apps };
}

/** Checks out every target without analyzing it: fills the clone cache the `run` jobs restore. */
async function fetchAll({ cache, jobs }) {
  let failed = 0;
  await forEachTarget(jobs, async (i) => {
    const target = targets[i];
    const error = await checkoutPinned(target, join(cache, target.repo.replace('/', '__')));
    if (error) {
      failed++;
      console.error(`FAIL  ${appId(target)}: ${error}`);
    }
  });
  return failed;
}

function verdictMap(dir = verdictsDir) {
  const map = new Map();
  for (const entry of readVerdicts(dir)) {
    if (!VERDICTS.includes(entry.verdict)) throw new Error(`${entry.key}: unknown verdict ${entry.verdict}`);
    if (map.has(entry.key)) throw new Error(`${entry.key}: duplicate verdict`);
    map.set(entry.key, entry);
  }
  return map;
}

/** Distinct keys per rule: what a verdict labels, and what precision is computed over. */
function keysByRule(measured) {
  const byRule = new Map();
  for (const { findings = [] } of measured.apps)
    for (const f of findings) {
      if (!byRule.has(f.rule)) byRule.set(f.rule, new Map());
      byRule.get(f.rule).set(f.key, f);
    }
  return byRule;
}

function aggregate(measured, verdicts, ruleIds) {
  const byRule = keysByRule(measured);
  const rules = {};
  for (const id of [...new Set([...ruleIds, ...byRule.keys()])].sort()) {
    const keys = byRule.get(id) ?? new Map();
    const row = { findings: keys.size, apps: new Set([...keys.values()].map((f) => f.key.split('::')[0])).size };
    for (const v of VERDICTS) row[v] = 0;
    for (const key of keys.keys()) {
      const verdict = verdicts.get(key)?.verdict;
      if (verdict) row[verdict]++;
    }
    rules[id] = row;
  }
  return rules;
}

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** A collapsed section; GitHub renders the markdown inside only when blank lines surround it. */
const details = (summary, body) => [`<details><summary>${summary}</summary>`, '', ...body, '</details>', ''];

function listFindings(title, byRule, verdicts, tagUnlabeled) {
  if (byRule.size === 0) return [];
  const lines = [];
  for (const [rule, findings] of byRule) {
    lines.push(`**\`${rule}\`** (${findings.length})`, '');
    for (const f of findings.slice(0, LIST_CAP)) {
      const [app, , locus] = f.key.split('::');
      const verdict = verdicts.get(f.key)?.verdict;
      const tag = verdict ? ` — verdict: \`${verdict}\`` : tagUnlabeled ? ' — **no verdict**' : '';
      lines.push(`- \`${app}\` \`${locus}\` ${escapeHtml(f.title)}${tag}`);
    }
    if (findings.length > LIST_CAP) lines.push(`- …and ${findings.length - LIST_CAP} more`);
    lines.push('');
  }
  const total = [...byRule.values()].reduce((n, findings) => n + findings.length, 0);
  return details(`${title} findings (${total})`, lines);
}

/**
 * `verdicts` is the head's ledger: the gate judges against it, so changing a verdict in the PR is
 * how an intended change goes through. `baseVerdicts` only gives the base column its precision.
 */
function diff(before, after, verdicts, measurement, baseVerdicts = verdicts) {
  // An app that failed on either side has no findings there; comparing it would list them all as moved.
  const failed = new Set([...before.apps, ...after.apps].filter((app) => app.error).map((app) => app.app));
  const comparable = (measured) => ({ apps: measured.apps.filter((app) => !failed.has(app.app)) });
  const a = keysByRule(comparable(before));
  const b = keysByRule(comparable(after));
  const rows = [];
  const added = new Map();
  const removed = new Map();
  const precisionOf = (keys, ledger) => {
    let tp = 0;
    let fp = 0;
    for (const key of keys.keys()) {
      const verdict = ledger.get(key)?.verdict;
      if (verdict === 'tp') tp++;
      else if (verdict === 'fp') fp++;
    }
    return tp + fp === 0 ? '—' : `${Math.round((100 * tp) / (tp + fp))}% (${tp}/${tp + fp})`;
  };
  for (const rule of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const was = a.get(rule) ?? new Map();
    const now = b.get(rule) ?? new Map();
    const plus = [...now.values()].filter((f) => !was.has(f.key));
    const minus = [...was.values()].filter((f) => !now.has(f.key));
    const [p0, p1] = [precisionOf(was, baseVerdicts), precisionOf(now, verdicts)];
    if (plus.length === 0 && minus.length === 0 && p0 === p1) continue;
    const net = plus.length - minus.length;
    rows.push(
      `| \`${rule}\` | ${was.size} | ${now.size} | +${plus.length} | -${minus.length} | ${net > 0 ? '+' : ''}${net} | ${p0 === p1 ? p1 : `${p0} → ${p1}`} |`
    );
    if (plus.length) added.set(rule, plus);
    if (minus.length) removed.set(rule, minus);
  }

  // The gate: a change may not silently drop a finding already judged real, or bring back one
  // judged false. Changing the verdict in verdicts/ in the same PR is the explicit way through.
  const lostTp = [...removed.values()].flat().filter((f) => verdicts.get(f.key)?.verdict === 'tp');
  const backFp = [...added.values()].flat().filter((f) => verdicts.get(f.key)?.verdict === 'fp');
  const failures = [];
  if (lostTp.length)
    failures.push(
      `${lostTp.length} real defect(s) (\`tp\`) are no longer reported. If that is intended, change or remove their verdicts in \`scripts/corpus/verdicts/\` in this PR`
    );
  if (backFp.length)
    failures.push(
      `${backFp.length} finding(s) labelled a false positive (\`fp\`) are reported: a fixed false positive came back, or one moved to a new location`
    );

  // An app left out of the comparison is unverified, not passed.
  if (failed.size) failures.push(`${failed.size} app(s) failed to measure, so the comparison is incomplete`);

  const stale =
    measurement &&
    !after.apps.some((app) => app.error) &&
    (measurement.targets !== digest(targets) ||
      measurement.verdicts !== digest(readVerdicts(verdictsDir)) ||
      JSON.stringify(aggregate(after, verdicts, Object.keys(measurement.rules))) !== JSON.stringify(measurement.rules));
  if (stale) failures.push('`scripts/corpus/measurement.json` is out of date: run `pnpm corpus update && pnpm format`');

  const out = [`## Corpus findings — ${failures.length ? '❌ gate failed' : '✅ gate passed'}`, ''];
  out.push(
    `Measured on ${targets.length} real SvelteKit apps (\`scripts/corpus/targets.json\`), base vs this PR. Verdicts come from \`scripts/corpus/verdicts/\`: **tp** a real defect, **fp** a false positive, **design** reported as documented but not a defect; a finding without one counts under "unclear or no verdict".`,
    ''
  );
  for (const [label, measured] of [
    ['base', before],
    ['head', after]
  ])
    for (const app of measured.apps)
      if (app.error)
        out.push(
          `> [!WARNING]`,
          `> \`${app.app}\` failed on ${label} and is left out of the comparison: ${escapeHtml(app.error)}`,
          ''
        );

  const tally = (byRule, ledger) => {
    const t = { findings: 0, tp: 0, fp: 0, design: 0, other: 0 };
    for (const keys of byRule.values())
      for (const key of keys.keys()) {
        t.findings++;
        const verdict = ledger.get(key)?.verdict;
        if (verdict === 'tp' || verdict === 'fp' || verdict === 'design') t[verdict]++;
        else t.other++;
      }
    return t;
  };
  const [t0, t1] = [tally(a, baseVerdicts), tally(b, verdicts)];
  const pct = (t) => (t.tp + t.fp === 0 ? '—' : `${((100 * t.tp) / (t.tp + t.fp)).toFixed(1)}%`);
  const delta = (x, y) => (y === x ? '±0' : `${y > x ? '+' : '−'}${Math.abs(y - x).toLocaleString('en-US')}`);
  const n = (x) => x.toLocaleString('en-US');
  const row = (name, key) => `| ${name} | ${n(t0[key])} | ${n(t1[key])} | ${delta(t0[key], t1[key])} |`;
  out.push(
    '| | base | this PR | change |',
    '| --- | ---: | ---: | ---: |',
    row('Findings', 'findings'),
    row('tp — real defects', 'tp'),
    row('fp — false positives', 'fp'),
    row('design — not a defect', 'design'),
    row('unclear or no verdict', 'other'),
    `| Precision, tp / (tp + fp) | ${pct(t0)} | ${pct(t1)} | |`,
    ''
  );

  // A removed finding's verdict may leave the ledger in the same PR, so fall back to the base's.
  const either = { get: (key) => verdicts.get(key) ?? baseVerdicts.get(key), has: (key) => verdicts.has(key) };
  const byVerdict = (byRule, ledger) => {
    const t = tally(new Map([...byRule].map(([rule, fs]) => [rule, new Map(fs.map((f) => [f.key, f]))])), ledger);
    const parts = ['tp', 'fp', 'design'].filter((v) => t[v]).map((v) => `${t[v]} ${v}`);
    if (t.other) parts.push(`${t.other} unclear or without a verdict`);
    return `${t.findings}${parts.length ? ` (${parts.join(', ')})` : ''}`;
  };
  out.push('**What changed**', '');
  if (rows.length === 0) out.push('- No finding was added or removed.');
  else {
    out.push(`- Added: ${byVerdict(added, verdicts)}`, `- Removed: ${byVerdict(removed, either)}`);
    const unlabeled = [...added.values()].flat().filter((f) => !verdicts.has(f.key)).length;
    if (unlabeled)
      out.push(`- ⚠️ ${unlabeled} added finding(s) have no verdict yet: label them in \`scripts/corpus/verdicts/\``);
  }
  for (const f of failures) out.push(`- ❌ ${f}`);
  out.push('');

  if (rows.length) {
    out.push(
      ...details(`Per-rule changes (${rows.length} rules)`, [
        '| rule | base | this PR | added | removed | net | precision |',
        '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
        ...rows,
        ''
      ]),
      ...listFindings('Added', added, verdicts, true),
      ...listFindings('Removed', removed, either, false)
    );
  }

  return { text: out.join('\n'), failures };
}

async function update({ cache, jobs }) {
  const { allRules } = await import('../packages/core/dist/internal.js');
  const measured = await run({ cli: join(root, 'packages/cli/dist/bin.js'), cache, jobs });
  const failed = measured.apps.filter((a) => a.error);
  if (failed.length) throw new Error(`${failed.length} app(s) failed; measurement.json left untouched`);

  const ledger = readVerdicts(verdictsDir);
  const verdicts = verdictMap();
  const measurement = {
    targets: digest(targets),
    verdicts: digest(ledger),
    rules: aggregate(
      measured,
      verdicts,
      allRules.map((r) => r.id)
    )
  };
  writeFileSync(measurementFile, `${JSON.stringify(measurement, null, 2)}\n`);

  const report = reportPath(root);
  writeFileSync(report, replaceBlock(readFileSync(report, 'utf8'), renderBlock(allRules, measurement, targets)));

  const found = new Set(measured.apps.flatMap((a) => a.findings.map((f) => f.key)));
  const orphans = ledger.filter((e) => !found.has(e.key));
  console.log(
    `\n${found.size} distinct findings, ${[...found].filter((k) => !verdicts.has(k)).length} without a verdict.`
  );
  if (orphans.length) {
    console.log(
      `${orphans.length} verdict(s) match no finding. Keep an \`fp\` one: it fails the gate if that false positive returns. Drop the rest:`
    );
    for (const o of orphans) console.log(`  ${o.key} (${o.verdict})`);
  }
  console.log('\nUpdated scripts/corpus/measurement.json and scripts/corpus/README.md. Now run: pnpm format');
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      cli: { type: 'string', default: join(root, 'packages/cli/dist/bin.js') },
      cache: { type: 'string', default: join(tmpdir(), 'svelte-vitals-corpus') },
      out: { type: 'string' },
      measurement: { type: 'string' },
      'base-verdicts': { type: 'string' },
      targets: { type: 'string' },
      jobs: { type: 'string', default: String(availableParallelism()) }
    }
  });
  const [command, ...files] = positionals;
  const cache = resolve(values.cache);
  const jobs = Number(values.jobs);
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs must be a positive integer, got ${values.jobs}`);
  if (command === 'run') {
    if (!values.out) throw new Error('run needs --out <file>');
    if (values.targets) targets = readJson(resolve(values.targets));
    const measured = await run({ cli: resolve(values.cli), cache, jobs });
    writeFileSync(values.out, JSON.stringify(measured));
    if (measured.apps.some((a) => a.error)) process.exitCode = 1;
  } else if (command === 'diff' && files.length === 2) {
    const [before, after] = files.map(readJson);
    const measurement = values.measurement ? readJson(values.measurement) : undefined;
    const baseLedger = values['base-verdicts'];
    const verdicts = verdictMap();
    const baseVerdicts = baseLedger && existsSync(baseLedger) ? verdictMap(baseLedger) : verdicts;
    const { text, failures } = diff(before, after, verdicts, measurement, baseVerdicts);
    console.log(text);
    // Distinct from 1, which an uncaught error also exits with.
    if (failures.length) process.exitCode = 3;
  } else if (command === 'update') {
    await update({ cache, jobs });
  } else if (command === 'fetch') {
    if (await fetchAll({ cache, jobs })) process.exitCode = 1;
  } else {
    console.error(
      'usage: corpus-measure.js run [--cli <bin.js>] [--cache <dir>] [--targets <file>] [--jobs <n>] --out <file>'
    );
    console.error(
      '       corpus-measure.js diff <before.json> <after.json> [--measurement <file>] [--base-verdicts <dir>]'
    );
    console.error('       corpus-measure.js update [--cache <dir>] [--jobs <n>]');
    console.error('       corpus-measure.js fetch [--cache <dir>] [--jobs <n>]');
    process.exitCode = 2;
  }
}

await main();
