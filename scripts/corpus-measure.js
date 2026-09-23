// Corpus precision (design doc: docs/superpowers/specs/2026-09-23-corpus-precision-design.md).
//
// Measures every rule's findings on real third-party SvelteKit apps pinned in scripts/corpus/targets.json
// and joins them with the human verdicts in scripts/corpus/verdicts.json. Reports; never gates.
//
//   node scripts/corpus-measure.js run [--cli <bin.js>] [--cache <dir>] --out <file>
//   node scripts/corpus-measure.js diff <before.json> <after.json> [--measurement <file>]
//   node scripts/corpus-measure.js update [--cache <dir>]
//
// Node builtins plus `git`, like ecosystem-smoke.js: no dev dependency may leak in here.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import {
  LOCALES,
  VERDICTS,
  appId,
  digest,
  pagePath,
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
const targets = readJson(join(corpusDir, 'targets.json'));
const verdictsFile = join(corpusDir, 'verdicts.json');
const measurementFile = join(corpusDir, 'measurement.json');

/**
 * One reading of the code decides a finding, so the route is not part of the key: a component
 * finding repeats on every route that renders it. Findings with no line fall back to the file,
 * with no file to the route (e.g. "Missing <h1>"), and site-level findings to `(site)`.
 */
function findingKey(app, issue, route) {
  const locus = issue.location
    ? issue.line != null
      ? `${issue.location}:${issue.line}`
      : issue.location
    : (route ?? '(site)');
  return `${app}::${issue.id}::${locus}`;
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
function analyze(cli, dir) {
  try {
    // `--no-suppressions` because a target's own recorded suppressions would silently hide
    // findings, and a suppressions file from a future format version is a hard exit 2.
    const stdout = execFileSync(process.execPath, [cli, dir, '--reporter', 'json', '--no-suppressions'], {
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
    else console.error(`ok    ${result.app} — exit ${result.exit}, ${result.findings.length} findings (${seconds}s)`);
    apps.push(result);
  }
  return { apps };
}

function verdictMap() {
  const map = new Map();
  for (const entry of readJson(verdictsFile)) {
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

function listFindings(title, byRule, verdicts, tagUnlabeled) {
  if (byRule.size === 0) return [];
  const lines = [`### ${title}`, ''];
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
  return lines;
}

function diff(before, after, verdicts, measurement) {
  // An app that failed on either side has no findings there; comparing it would list them all as moved.
  const failed = new Set([...before.apps, ...after.apps].filter((app) => app.error).map((app) => app.app));
  const comparable = (measured) => ({ apps: measured.apps.filter((app) => !failed.has(app.app)) });
  const a = keysByRule(comparable(before));
  const b = keysByRule(comparable(after));
  const rows = [];
  const added = new Map();
  const removed = new Map();
  for (const rule of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const was = a.get(rule) ?? new Map();
    const now = b.get(rule) ?? new Map();
    const plus = [...now.values()].filter((f) => !was.has(f.key));
    const minus = [...was.values()].filter((f) => !now.has(f.key));
    if (plus.length === 0 && minus.length === 0) continue;
    const net = plus.length - minus.length;
    rows.push(
      `| \`${rule}\` | ${was.size} | ${now.size} | +${plus.length} | -${minus.length} | ${net > 0 ? '+' : ''}${net} |`
    );
    if (plus.length) added.set(rule, plus);
    if (minus.length) removed.set(rule, minus);
  }

  const out = ['## Corpus findings', ''];
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
    out.push(
      `Distinct findings (\`app::rule::file:line\`) on ${targets.length} pinned apps. ${unlabeled} added finding(s) have no verdict in \`scripts/corpus/verdicts.json\`.`,
      '',
      '| rule | base | head | added | removed | net |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
      ...rows,
      '',
      ...listFindings('Added', added, verdicts, true),
      ...listFindings('Removed', removed, verdicts, false)
    );
  }

  if (measurement && !after.apps.some((app) => app.error)) {
    const now = aggregate(after, verdicts, Object.keys(measurement.rules));
    if (JSON.stringify(now) !== JSON.stringify(measurement.rules))
      out.push('`scripts/corpus/measurement.json` is stale — run `pnpm corpus update`.', '');
  }
  return out.join('\n');
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

  const docsRoot = join(root, 'docs/src/content/docs');
  for (const locale of LOCALES) {
    const file = pagePath(docsRoot, locale);
    writeFileSync(file, replaceBlock(readFileSync(file, 'utf8'), renderBlock(locale, allRules, measurement, targets)));
  }

  const found = new Set(measured.apps.flatMap((a) => a.findings.map((f) => f.key)));
  const orphans = ledger.filter((e) => !found.has(e.key));
  console.log(
    `\n${found.size} distinct findings, ${[...found].filter((k) => !verdicts.has(k)).length} without a verdict.`
  );
  if (orphans.length) {
    console.log(
      `${orphans.length} verdict(s) match no finding (fixed, or moved lines) — drop them from verdicts.json:`
    );
    for (const o of orphans) console.log(`  ${o.key} (${o.verdict})`);
  }
  // The en page's raw text is what the translation ledger hashes, and both halves were just
  // regenerated from the same data, so re-stamping here is an honest assertion.
  console.log(
    '\nUpdated scripts/corpus/measurement.json and the Rule reliability pages (en + ja). Now run:\n' +
      '  pnpm format && pnpm --filter docs run translate:stamp "src/content/docs/guides/(reporting)/rule-reliability.md"'
  );
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      cli: { type: 'string', default: join(root, 'packages/cli/dist/bin.js') },
      cache: { type: 'string', default: join(tmpdir(), 'svelte-vitals-corpus') },
      out: { type: 'string' },
      measurement: { type: 'string' }
    }
  });
  const [command, ...files] = positionals;
  const cache = resolve(values.cache);
  if (command === 'run') {
    if (!values.out) throw new Error('run needs --out <file>');
    const measured = run({ cli: resolve(values.cli), cache });
    writeFileSync(values.out, JSON.stringify(measured));
    if (measured.apps.some((a) => a.error)) process.exitCode = 1;
  } else if (command === 'diff' && files.length === 2) {
    const [before, after] = files.map(readJson);
    const measurement = values.measurement ? readJson(values.measurement) : undefined;
    console.log(diff(before, after, verdictMap(), measurement));
  } else if (command === 'update') {
    await update({ cache });
  } else {
    console.error('usage: corpus-measure.js run [--cli <bin.js>] [--cache <dir>] --out <file>');
    console.error('       corpus-measure.js diff <before.json> <after.json> [--measurement <file>]');
    console.error('       corpus-measure.js update [--cache <dir>]');
    process.exitCode = 2;
  }
}

await main();
