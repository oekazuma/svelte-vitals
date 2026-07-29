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
  /** Path segments in the key, wildcards included. More segments means more specific. */
  segments: number;
  /** How many of those segments are exactly `**`. Fewer means more specific. */
  doubleStars: number;
}

/** Segment count and whole-`**`-segment count, computed once at compile time. */
function keyShape(key: string): { segments: number; doubleStars: number } {
  const parts = key.split('/');
  let doubleStars = 0;
  for (const p of parts) if (p === '**') doubleStars++;
  return { segments: parts.length, doubleStars };
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
        ...keyShape(key),
        ...(bareGuard && key.endsWith('/**') ? { barePrefixRe: routeGlobToRegExp(key.slice(0, -3)) } : {})
      }));
      cache.set(cacheKey, entry);
    }
    return entry;
  };
}

/**
 * Every declaration key matching `dir`, and the one that governs it. The most specific declaration
 * wins — see `moreSpecific` for the ordering — and among equal specificity the lexicographically
 * first wins, because additive merging across config layers makes key insertion order unintuitive.
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
 * segment, and no literal directory string can ever equal a glob. The same guard applies to
 * `pascalCaseUnits`, not only `units`: a key ending in a trailing double-star segment means
 * "everything under X" there too, and must not include X itself. The casing gate at the call site
 * does not already handle this — a root whose own basename happens to be PascalCase
 * (`src/Components/**`) would otherwise pass the gate and be demanded to contain
 * `Components/Components.svelte` — so the guard must not depend on a container happening to be
 * named in lowercase. (One consequence: a key of `src/**` followed by `/**` compiles a
 * `barePrefixRe` matching every directory the key itself matches, so that key is inert against
 * itself and reports as a declaration that checks nothing. That is the loud, correct failure mode
 * for a nonsensical glob, not a crash.)
 */
export function matchKeys(dir: string, compiled: CompiledKey[]): { matched: string[]; best?: string } {
  const matched: string[] = [];
  let best: CompiledKey | undefined;
  for (const entry of compiled) {
    if (entry.barePrefixRe?.test(dir)) continue;
    if (!entry.re.test(dir)) continue;
    matched.push(entry.key);
    if (best === undefined || moreSpecific(entry, best)) best = entry;
  }
  return best === undefined ? { matched } : { matched, best: best.key };
}

/**
 * Whether `a` is a more specific declaration than `b`.
 *
 * Depth first, because constraining depth is the strongest thing a key says; then whole `**`
 * segments, fewer winning, because `**` is the loosest thing a key can contain; only then the
 * string length and lexicographic order that used to decide this alone.
 *
 * Length alone is wrong and shipped wrong once: `src/lib/features/**` is one character LONGER than
 * `src/lib/features/*`, so the broader key won and the narrower declaration silently did nothing.
 *
 * One consequence, deliberate: because rule 1 counts wildcard segments too, `src/*​/*​/*` outranks
 * `src/routes/**` despite naming nothing literal. Constraining depth is a form of specificity, so
 * this is defensible, but it is the reverse of the CSS-like intuition that more literal text means
 * more specific. The rule pages say so.
 */
function moreSpecific(a: CompiledKey, b: CompiledKey): boolean {
  if (a.segments !== b.segments) return a.segments > b.segments;
  if (a.doubleStars !== b.doubleStars) return a.doubleStars < b.doubleStars;
  if (a.key.length !== b.key.length) return a.key.length > b.key.length;
  return a.key < b.key;
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

/** Whether `dir` or any of its `ancestors` matches an `exclude` glob — the subtree is pruned. */
export function isExcluded(dir: string, ancestors: string[], excluded: CompiledKey[]): boolean {
  return excluded.some(({ re }) => re.test(dir) || ancestors.some((a) => re.test(a)));
}

/** Why a declaration ended a run without checking anything. */
export type UnusedReason = 'no-match' | 'only-excluded';

/**
 * Why each key in `unused` did no work.
 *
 * This is a deliberately deferred second pass. The main pass skips an excluded directory before
 * testing any key against it — which is both the fix for shadowed declarations and a saving on the
 * hot path — and that ordering is exactly what makes it unable to tell "matched nothing" from
 * "matched only excluded directories". Classifying here restores the distinction without giving the
 * saving back: a correct configuration leaves `unused` empty, so this returns immediately and the
 * excluded paths are never tested at all.
 *
 * The bare-prefix guard applies here too. Without it a key of `src/lib/**` would "match" an excluded
 * `src/lib` and be labelled shadowed when it in fact matched nothing.
 */
export function classifyUnusedKeys(
  unused: string[],
  excludedDirs: string[],
  compile: (globs: string[], bareGuard?: boolean) => CompiledKey[]
): Map<string, UnusedReason> {
  const out = new Map<string, UnusedReason>();
  if (unused.length === 0) return out;
  for (const { key, re, barePrefixRe } of compile(unused, true)) {
    const shadowed = excludedDirs.some((d) => !barePrefixRe?.test(d) && re.test(d));
    out.set(key, shadowed ? 'only-excluded' : 'no-match');
  }
  return out;
}
