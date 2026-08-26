/**
 * Glob-declaration machinery shared by the Architecture rules that let a project declare a
 * convention over directory globs — `architecture/unit-entry-file` (design 2026-07-28),
 * `architecture/directory-naming` and `architecture/reserved-directory-names` (both design
 * 2026-07-29).
 *
 * Extracted rather than copied on purpose. The trailing-double-star guard below produced three
 * successive false positives in the first rule that needed it, and a second copy is how a fourth
 * one arrives. This module holds what more than one directory-shaped rule needs to agree on: which
 * declaration governs a directory, how a declaration's `|`-separated value is split, and how the
 * directory set relates to the file inventory. What a rule then does with a directory it governs
 * stays in the rule.
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
 * Immediate subdirectories of every directory in `dirs`, keyed by parent, each list sorted.
 *
 * A caller that enumerates a parent's children exhaustively inherits two properties of the inventory
 * these paths come from, and both matter: a directory holding no file at any depth never appears, and
 * neither does a dot directory. See `collectSourceFiles`.
 */
export function childDirs(dirs: Iterable<string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const dir of dirs) {
    const cut = dir.lastIndexOf('/');
    if (cut === -1) continue; // a top-level directory has no parent inside the inventory
    const parent = dir.slice(0, cut);
    let kids = out.get(parent);
    if (kids === undefined) out.set(parent, (kids = []));
    kids.push(dir);
  }
  for (const kids of out.values()) kids.sort();
  return out;
}

/** Immediate file basenames of every directory holding at least one, keyed by directory, sorted. */
export function childFiles(files: Iterable<string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of files) {
    const cut = file.lastIndexOf('/');
    if (cut === -1) continue; // a file at the root sits in no directory
    const dir = file.slice(0, cut);
    let own = out.get(dir);
    if (own === undefined) out.set(dir, (own = []));
    own.push(file.slice(cut + 1));
  }
  for (const own of out.values()) own.sort();
  return out;
}

/**
 * The `|`-separated tokens of a declaration value, trimmed, with empty tokens dropped.
 *
 * Two rules encode a set inside one `string-map` value this way, and both need the same answer for
 * `'a | b'`, `'a||b'` and `'|'` — the last of which names nothing and must be reported rather than
 * silently governing.
 */
export function splitNames(value: string): string[] {
  const out: string[] = [];
  for (const raw of value.split('|')) {
    const token = raw.trim();
    if (token.length > 0) out.push(token);
  }
  return out;
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
function keyShape(key: string) {
  const parts = key.split('/');
  let doubleStars = 0;
  for (const p of parts) if (p === '**') doubleStars++;
  return { segments: parts.length, doubleStars };
}

/**
 * A memoised compiler. A project has a handful of distinct declarations and thousands of
 * directories, so the same glob list is compiled once per rule run. `bareGuard` is part of the
 * cache key, so the same globs compiled both ways do not collide.
 *
 * All three rules compile their `exclude` globs with `bareGuard` left at its default `false`, and must:
 * a declaration key ending in a trailing double-star segment means "everything under X, not X
 * itself", which is exactly why that key needs its bare prefix guarded away — but an `exclude` glob
 * ending the same way means "this directory and everything below it", the opposite claim, so its
 * regex is supposed to keep matching its own bare prefix. Guarding it away there would silently
 * un-exclude the very directory the project meant to prune.
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
 * wins — see `moreSpecificShaped` for the ordering — and among equal specificity the lexicographically
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
 * segment, and no literal directory string can ever equal a glob.
 *
 * Two consumers need this guard for two options at once, and each is worth recording here.
 * `architecture/unit-entry-file` guards `pascalCaseUnits` for the same reason as
 * `units`: a key ending in a trailing double-star segment means "everything under X" there too, and
 * must not include X itself. That rule's own casing gate does not already handle this — a root
 * whose own basename happens to be PascalCase (`src/Components/**`) would otherwise pass the gate
 * and be demanded to contain `Components/Components.svelte` — so the guard cannot depend on a
 * container happening to be named in lowercase. `architecture/reserved-directory-names` is the
 * second: its `unitScopes` map is exactly as reliant on the guard as `units` is for the first rule,
 * for the identical reason — a root that is itself a unit must not be asked to contain a
 * same-named child of itself. `architecture/directory-naming`, this module's third consumer, has
 * only one glob-map option and no casing gate, so this particular case does not arise for it — the
 * guard itself still applies the same way to its `directories` keys. (One
 * consequence: a key of `src/**` followed by `/**` compiles a
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
    if (best === undefined || moreSpecificShaped(entry, best)) best = entry;
  }
  return best === undefined ? { matched } : { matched, best: best.key };
}

/** The three fields the ordering reads, so a compiled key and a bare glob can share one comparator. */
interface Shaped {
  key: string;
  segments: number;
  doubleStars: number;
}

/**
 * Whether `a` is a more specific declaration than `b`.
 *
 * Depth first, because constraining depth is the strongest thing a key says; then whole `**`
 * segments, fewer winning, because `**` is the loosest thing a key can contain; only then the string
 * length and lexicographic order that used to decide this alone.
 *
 * Length alone is wrong and shipped wrong once: `src/lib/features/**` is one character LONGER than
 * `src/lib/features/*`, so the broader key won and the narrower declaration silently did nothing.
 *
 * Two consequences worth naming. Because step 1 counts wildcard segments too, `src/*​/*​/*` outranks
 * `src/routes/**` despite naming nothing literal — constraining depth is a form of specificity, but
 * it is the reverse of the CSS-like intuition that more literal text means more specific. And because
 * the last step is lexicographic on the whole key, **two different globs are always separated**; only
 * two identical globs leave this false in both directions, which is what lets a caller comparing keys
 * from two different option maps detect that case and decide it itself.
 */
function moreSpecificShaped(a: Shaped, b: Shaped): boolean {
  if (a.segments !== b.segments) return a.segments > b.segments;
  if (a.doubleStars !== b.doubleStars) return a.doubleStars < b.doubleStars;
  if (a.key.length !== b.key.length) return a.key.length > b.key.length;
  return a.key < b.key;
}

/** As `moreSpecificShaped`, for two globs that have not been compiled. */
export function moreSpecificGlob(a: string, b: string): boolean {
  return moreSpecificShaped({ key: a, ...keyShape(a) }, { key: b, ...keyShape(b) });
}

/**
 * The file a finding about `dir` should report at, or `undefined` when nothing lies beneath it.
 *
 * What this returns must become `location`, never `route`: `filterToChangedFiles` keeps only
 * locations git lists as changed, and git never lists a directory, so a finding whose `location` is
 * a directory disappears from every `--diff` run. `route` has no such constraint. Two consumers of
 * this module key `route` on the directory itself for a violation, precisely so a nested violation
 * keeps its own identity in `id::route::location` (`packages/cli/src/baseline.ts`) even when it
 * shares a `location` with an ancestor's violation; the third, `architecture/reserved-directory-names`,
 * keys it on the offending **child** directory instead, since the parent it resolved options for is
 * not itself the violation. See each rule's own comment on its result for why.
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
 * Which of `keys` match at least one of `dirs`.
 *
 * The bare-prefix guard applies: without it a key of `src/lib/**` would "match" a `src/lib` in the
 * list, which is the one directory that key is written to reach *under*.
 */
export function keysMatchingAny(
  keys: string[],
  dirs: readonly string[],
  compile: (globs: string[], bareGuard?: boolean) => CompiledKey[]
): Set<string> {
  const hit = new Set<string>();
  if (keys.length === 0 || dirs.length === 0) return hit;
  for (const { key, re, barePrefixRe } of compile(keys, true)) {
    if (dirs.some((d) => !barePrefixRe?.test(d) && re.test(d))) hit.add(key);
  }
  return hit;
}

/**
 * Why each key in `unused` did no work.
 *
 * This is a deliberately deferred second pass. The main pass skips an excluded directory before
 * testing any key against it — which is both the fix for shadowed declarations and a saving on the
 * hot path — and that ordering is exactly what makes it unable to tell "matched nothing" from
 * "matched only excluded directories". Classifying here restores the distinction without giving the
 * saving back: a correct configuration leaves `unused` empty, so this returns immediately and the
 * excluded paths are never tested at all.
 */
export function classifyUnusedKeys(
  unused: string[],
  excludedDirs: string[],
  compile: (globs: string[], bareGuard?: boolean) => CompiledKey[]
): Map<string, UnusedReason> {
  const out = new Map<string, UnusedReason>();
  if (unused.length === 0) return out;
  const shadowed = keysMatchingAny(unused, excludedDirs, compile);
  for (const key of unused) out.set(key, shadowed.has(key) ? 'only-excluded' : 'no-match');
  return out;
}
