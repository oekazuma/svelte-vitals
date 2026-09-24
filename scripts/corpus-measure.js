// Corpus precision (design doc: docs/superpowers/specs/2026-09-23-corpus-precision-design.md).
//
// Measures every rule's findings on real third-party SvelteKit apps pinned in scripts/corpus/targets.json
// and joins them with the human verdicts in scripts/corpus/verdicts.json. Reports; never gates.
//
//   node scripts/corpus-measure.js run [--cli <bin.js>] [--cache <dir>] [--targets <file>] --out <file>
//   node scripts/corpus-measure.js diff <before.json> <after.json> [--measurement <file>] [--base-verdicts <file>]
//   node scripts/corpus-measure.js update [--cache <dir>]
//
// Node builtins plus `git`, like ecosystem-smoke.js: no dev dependency may leak in here.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import {
  VERDICTS,
  appId,
  digest,
  reportPath,
  renderBlock,
  replaceBlock
} from '../packages/cli/scripts/rule-reliability.js';

const ANALYZE_TIMEOUT_MS = 180_000;
const CLONE_TIMEOUT_MS = 300_000;
const STDOUT_CAP_MB = 64;
const LIST_CAP = 20;

const root = join(import.meta.dirname, '..');
const corpusDir = join(root, 'scripts/corpus');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
// `--targets` swaps in another pinned list (the v1 holdout) for `run`; everything else uses the corpus.
let targets = readJson(join(corpusDir, 'targets.json'));
const verdictsFile = join(corpusDir, 'verdicts.json');
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

/** Never throws: returns the exit code alongside the captured streams. */
function analyze(cli, dir) {
  // `--no-suppressions` because a target's own recorded suppressions would silently hide
  // findings, and a suppressions file from a future format version is a hard exit 2.
  const r = spawnSync(process.execPath, [cli, dir, '--reporter', 'json', '--no-suppressions'], {
    encoding: 'utf8',
    timeout: ANALYZE_TIMEOUT_MS,
    maxBuffer: STDOUT_CAP_MB * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', signal: r.signal ?? null };
}

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

/** Clone-by-SHA into `dir` (or move an existing clone to the SHA); returns an error string or undefined. */
function checkoutPinned({ repo, sha }, dir) {
  // Without its own `.git`, `git -C` would walk up and fetch into whatever repo encloses the cache.
  if (!existsSync(join(dir, '.git'))) {
    if (existsSync(dir)) return `${dir} exists but is not a git clone`;
    mkdirSync(dir, { recursive: true });
    git(['init', '--quiet', dir]);
  } else {
    try {
      if (git(['-C', dir, 'rev-parse', 'HEAD']) === sha) return undefined;
    } catch {
      // a clone whose first fetch failed has no HEAD yet
    }
  }
  try {
    git(['-C', dir, 'fetch', '--quiet', '--depth', '1', `https://github.com/${repo}.git`, sha], {
      timeout: CLONE_TIMEOUT_MS
    });
    git(['-C', dir, 'checkout', '--quiet', '--force', '--detach', 'FETCH_HEAD']);
    return undefined;
  } catch (e) {
    const reason = String(e.stderr ?? '')
      .split('\n')
      .find((l) => l.trim().length > 0);
    return `fetch ${sha} failed: ${reason ?? e.message.split('\n')[0]}`;
  }
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

function measureTarget(target, cli, cache) {
  const app = appId(target);
  const dir = join(cache, target.repo.replace('/', '__'));
  const error = checkoutPinned(target, dir);
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

  const { code, stdout, stderr, signal } = analyze(cli, real);
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

function run({ cli, cache }) {
  if (!existsSync(cli)) throw new Error(`${cli} is missing — run \`pnpm build\` first.`);
  const apps = [];
  for (const target of targets) {
    const started = Date.now();
    const result = measureTarget(target, cli, cache);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (result.error) console.error(`FAIL  ${result.app} (${seconds}s): ${result.error}`);
    else {
      const distinct = new Set(result.findings.map((f) => f.key)).size;
      console.error(`ok    ${result.app} — exit ${result.exit}, ${distinct} distinct findings (${seconds}s)`);
    }
    apps.push(result);
  }
  return { apps };
}

function verdictMap(file = verdictsFile) {
  const map = new Map();
  for (const entry of readJson(file)) {
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
  // judged false. Changing the verdict in verdicts.json in the same PR is the explicit way through.
  const lostTp = [...removed.values()].flat().filter((f) => verdicts.get(f.key)?.verdict === 'tp');
  const backFp = [...added.values()].flat().filter((f) => verdicts.get(f.key)?.verdict === 'fp');
  const failures = [];
  if (lostTp.length)
    failures.push(
      `${lostTp.length} finding(s) with a \`tp\` verdict are no longer reported (a real defect is now missed)`
    );
  if (backFp.length) failures.push(`${backFp.length} finding(s) with an \`fp\` verdict are reported again`);

  // An app left out of the comparison is unverified, not passed.
  if (failed.size) failures.push(`${failed.size} app(s) failed to measure, so the comparison is incomplete`);

  const out = ['## Corpus findings', ''];
  const stale =
    measurement &&
    !after.apps.some((app) => app.error) &&
    (measurement.targets !== digest(targets) ||
      measurement.verdicts !== digest(readJson(verdictsFile)) ||
      JSON.stringify(aggregate(after, verdicts, Object.keys(measurement.rules))) !== JSON.stringify(measurement.rules));
  if (stale) failures.push('`scripts/corpus/measurement.json` is stale — run `pnpm corpus update`');
  if (failures.length) out.push('**❌ Corpus gate failed**', '', ...failures.map((f) => `- ${f}`), '');
  else out.push('**✅ Corpus gate passed**', '');
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

  if (rows.length === 0) out.push('No finding was added or removed on the pinned corpus.', '');
  else {
    const unlabeled = [...added.values()].flat().filter((f) => !verdicts.has(f.key)).length;
    const count = (byRule) => [...byRule.values()].reduce((n, findings) => n + findings.length, 0);
    out.push(
      `Distinct findings (\`app::rule::file:line::claim\`) on ${targets.length} pinned apps: +${count(added)} added, -${count(removed)} removed across ${rows.length} rule(s). ${unlabeled} added finding(s) have no verdict in \`scripts/corpus/verdicts.json\`.`,
      '',
      ...details(`Per-rule changes (${rows.length})`, [
        '| rule | base | head | added | removed | net | precision |',
        '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
        ...rows,
        ''
      ]),
      ...listFindings('Added', added, verdicts, true),
      ...listFindings('Removed', removed, verdicts, false)
    );
  }

  return { text: out.join('\n'), failures };
}

async function update({ cache }) {
  const { allRules } = await import('../packages/core/dist/internal.js');
  const measured = run({ cli: join(root, 'packages/cli/dist/bin.js'), cache });
  const failed = measured.apps.filter((a) => a.error);
  if (failed.length) throw new Error(`${failed.length} app(s) failed; measurement.json left untouched`);

  const ledger = readJson(verdictsFile);
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
      targets: { type: 'string' }
    }
  });
  const [command, ...files] = positionals;
  const cache = resolve(values.cache);
  if (command === 'run') {
    if (!values.out) throw new Error('run needs --out <file>');
    if (values.targets) targets = readJson(resolve(values.targets));
    const measured = run({ cli: resolve(values.cli), cache });
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
    await update({ cache });
  } else {
    console.error('usage: corpus-measure.js run [--cli <bin.js>] [--cache <dir>] [--targets <file>] --out <file>');
    console.error(
      '       corpus-measure.js diff <before.json> <after.json> [--measurement <file>] [--base-verdicts <file>]'
    );
    console.error('       corpus-measure.js update [--cache <dir>]');
    process.exitCode = 2;
  }
}

await main();
