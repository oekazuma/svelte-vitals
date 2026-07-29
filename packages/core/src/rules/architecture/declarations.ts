/**
 * Glob-declaration machinery shared by the Architecture rules that let a project declare a
 * convention over directory globs — `architecture/unit-entry-file` (design 2026-07-28) and
 * `architecture/directory-naming` (design 2026-07-29).
 *
 * Extracted rather than copied on purpose. The trailing-double-star guard below produced three
 * successive false positives in the first rule that needed it, and a second copy is how a fourth
 * one arrives. Everything here is about *which declaration governs a directory*; what a rule then
 * does with that directory stays in the rule.
 */
import { routeGlobToRegExp } from '../../config-apply.js';

/** Every ancestor directory of `file`, shallowest first (`a/b/c.ts` → ['a', 'a/b']). */
export function ancestorDirs(file: string): string[] {
  const segments = file.split('/');
  const out: string[] = [];
  for (let i = 1; i < segments.length; i++) out.push(segments.slice(0, i).join('/'));
  return out;
}

/** The basename of a directory path. */
export function baseName(dir: string): string {
  const cut = dir.lastIndexOf('/');
  return cut === -1 ? dir : dir.slice(cut + 1);
}

/**
 * A compiled declaration key. `barePrefixRe` is set only when the caller asked for the guard and
 * the key ends in a trailing double-star segment — see `matchKeys`. It is a compiled RegExp, not
 * the bare glob string: the prefix is itself a glob whenever the key carries a wildcard before that
 * trailing segment, so no real directory can ever equal it as a plain string, and a string
 * comparison against it never fires.
 */
export interface CompiledKey {
  key: string;
  re: RegExp;
  barePrefixRe?: RegExp;
}

/**
 * A memoised compiler. A project has a handful of distinct declarations and thousands of
 * directories, so the same glob list is compiled once per rule run. `bareGuard` is part of the
 * cache key, so the same globs compiled both ways do not collide.
 */
export function createKeyCompiler(): (globs: string[], bareGuard?: boolean) => CompiledKey[] {
  const cache = new Map<string, CompiledKey[]>();
  return (globs: string[], bareGuard = false): CompiledKey[] => {
    const cacheKey = JSON.stringify([globs, bareGuard]);
    let entry = cache.get(cacheKey);
    if (entry === undefined) {
      entry = globs.map((key) => ({
        key,
        re: routeGlobToRegExp(key),
        ...(bareGuard && key.endsWith('/**') ? { barePrefixRe: routeGlobToRegExp(key.slice(0, -3)) } : {})
      }));
      cache.set(cacheKey, entry);
    }
    return entry;
  };
}

/**
 * Every declaration key matching `dir`, and the one that governs it.
 *
 * `matched` carries ALL of them, not just the winner: a key that matched a directory but lost the
 * tie-break has still done work, and reporting it as a declaration that checks nothing would be a
 * lie.
 *
 * An entry whose `barePrefixRe` matches `dir` is skipped entirely, not merely denied the win. A
 * trailing `/**` compiles to `(/.*)?`, which also matches the bare prefix itself, so
 * `{ 'src/lib/functions/**': ... }` would otherwise also govern `src/lib/functions` — the container
 * the key was written to reach *under*. The prefix is compiled rather than compared as a string
 * because it is itself a glob when the key carries a wildcard before the trailing double-star
 * segment, and no literal directory string can ever equal a glob.
 */
export function matchKeys(dir: string, compiled: CompiledKey[]): { matched: string[]; best?: string } {
  const matched: string[] = [];
  let best: string | undefined;
  for (const { key, re, barePrefixRe } of compiled) {
    if (barePrefixRe?.test(dir)) continue;
    if (!re.test(dir)) continue;
    matched.push(key);
    if (best === undefined || key.length > best.length || (key.length === best.length && key < best)) best = key;
  }
  return best === undefined ? { matched } : { matched, best };
}

/**
 * The file a finding about `dir` should report at, or `undefined` when nothing lies beneath it.
 *
 * A finding is never keyed on the directory itself: `filterToChangedFiles` keeps only locations git
 * lists as changed, and git never lists a directory, so a directory-keyed finding disappears from
 * every `--diff` run.
 *
 * A direct child is preferred so the finding sits next to the directory it is about, falling back to
 * the subtree for a directory holding only subdirectories. Both branches take the lexicographically
 * first candidate: the caller's inventory is sorted today, but `location` is what a baseline entry
 * and a `--diff` run are keyed on, so letting an adapter's traversal order decide it would move
 * findings silently rather than fail.
 */
export function reportAt(dir: string, files: string[]): string | undefined {
  const prefix = `${dir}/`;
  const under = files.filter((f) => f.startsWith(prefix)).sort();
  return under.find((f) => !f.slice(prefix.length).includes('/')) ?? under[0];
}
