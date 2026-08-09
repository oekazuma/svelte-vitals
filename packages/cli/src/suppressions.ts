import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config, Result } from '@svelte-vitals/core';
import { isPenalized } from '@svelte-vitals/core';
import { findingKey } from './baseline.js';
import { isPlainObject } from './config-file.js';

/**
 * Persistent adoption ramp (design doc 2026-07-13-suppressions-file-design.md):
 * accept every currently-penalized finding once (`--update-suppressions`), then
 * gate only on findings that appear afterward. Unlike `--baseline <ref>` (a
 * transient git-ref comparison), this file is committed and applied on every run.
 */
export const SUPPRESSIONS_FILE = 'svelte-vitals-suppressions.json';

export interface SuppressionEntry {
  id: string;
  route?: string;
  location?: string;
}

/**
 * Reads `svelte-vitals-suppressions.json` from `cwd`. Returns `undefined` when
 * the file doesn't exist. Throws when the file exists but is not valid JSON, its
 * top-level shape isn't `{ version: 1, suppressions: [...] }`, or an entry is
 * missing a string `id` — a silently-ignored typo would un-gate CI, so malformed
 * files are a hard error (mapped to exit 2 by the caller). Unknown keys (both
 * top-level and per-entry) are ignored for forward compatibility.
 */
export function loadSuppressions(cwd: string): SuppressionEntry[] | undefined {
  const path = join(cwd, SUPPRESSIONS_FILE);

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `invalid ${SUPPRESSIONS_FILE}: not valid JSON (${err instanceof Error ? err.message : String(err)}).`,
      { cause: err }
    );
  }

  if (!isPlainObject(parsed)) {
    throw new Error(`invalid ${SUPPRESSIONS_FILE}: expected a top-level JSON object.`);
  }
  if (parsed.version !== 1) {
    throw new Error(`invalid ${SUPPRESSIONS_FILE}: expected "version": 1, got ${JSON.stringify(parsed.version)}.`);
  }
  if (!Array.isArray(parsed.suppressions)) {
    throw new Error(`invalid ${SUPPRESSIONS_FILE}: "suppressions" must be an array.`);
  }

  const entries: SuppressionEntry[] = [];
  parsed.suppressions.forEach((entry: unknown, i: number) => {
    if (!isPlainObject(entry) || typeof entry.id !== 'string') {
      throw new Error(`invalid ${SUPPRESSIONS_FILE}: suppressions[${i}] must be an object with a string "id".`);
    }
    entries.push({
      id: entry.id,
      ...(typeof entry.route === 'string' ? { route: entry.route } : {}),
      ...(typeof entry.location === 'string' ? { location: entry.location } : {})
    });
  });

  return entries;
}

function toEntry(r: Result): SuppressionEntry {
  return {
    id: r.id,
    ...(r.route !== undefined ? { route: r.route } : {}),
    ...(r.location !== undefined ? { location: r.location } : {})
  };
}

function compareEntries(a: SuppressionEntry, b: SuppressionEntry): number {
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  const ar = a.route ?? '';
  const br = b.route ?? '';
  if (ar !== br) return ar < br ? -1 : 1;
  const al = a.location ?? '';
  const bl = b.location ?? '';
  if (al !== bl) return al < bl ? -1 : 1;
  return 0;
}

/**
 * Full rewrite of `svelte-vitals-suppressions.json`: records every currently
 * penalized finding in `results` (passing seeds are never written) and prunes
 * anything not present anymore. Entries are de-duplicated and sorted by
 * (id, route, location) for stable diffs. Returns the number of entries written.
 */
export function writeSuppressions(cwd: string, results: Result[], config: Config): number {
  const seen = new Set<string>();
  const entries: SuppressionEntry[] = [];
  for (const r of results) {
    if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
    const entry = toEntry(r);
    const key = findingKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  entries.sort(compareEntries);

  const path = join(cwd, SUPPRESSIONS_FILE);
  // Same-directory tmp file: renameSync is only atomic within one filesystem.
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify({ version: 1, suppressions: entries }, null, 2) + '\n');
    renameSync(tmpPath, path);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // best-effort cleanup; original error takes precedence
    }
    throw err;
  }
  return entries.length;
}

/**
 * Removes penalized findings whose key matches a suppression entry. Passing
 * seeds are never removed even if their key happens to match. Reports how many
 * findings were suppressed and how many entries in `entries` matched nothing
 * (stale — most likely fixed since the file was last written).
 *
 * `allResults` (defaults to `results`) is used only for the staleness tally, not
 * for filtering: a caller that narrows `results` to a subset of files/findings
 * (`--diff`/`--staged`/`--baseline`) can still pass the pre-scope, project-wide
 * result set here so an entry whose finding survives elsewhere in the project
 * isn't misreported as stale just because this run's scope excluded it.
 */
export function applySuppressions(
  results: Result[],
  entries: SuppressionEntry[],
  config: Config,
  allResults?: Result[]
): { results: Result[]; suppressed: number; stale: number } {
  const keys = new Set(entries.map((e) => findingKey(e)));
  const kept: Result[] = [];
  let suppressed = 0;

  for (const r of results) {
    const key = findingKey(r);
    if (keys.has(key) && isPenalized(r.detection, config.treatDynamicAs)) {
      suppressed++;
      continue;
    }
    kept.push(r);
  }

  const usedKeys = new Set<string>();
  for (const r of allResults ?? results) {
    const key = findingKey(r);
    if (keys.has(key) && isPenalized(r.detection, config.treatDynamicAs)) usedKeys.add(key);
  }
  const stale = [...keys].filter((k) => !usedKeys.has(k)).length;

  return { results: kept, suppressed, stale };
}
