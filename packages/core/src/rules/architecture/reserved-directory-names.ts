import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import {
  isMentionedAnywhere,
  listOption,
  mapOption,
  resolveRuleOptions,
  type RuleOptionsSpec
} from '../../rule-options.js';
import {
  ancestorDirs,
  baseName,
  childDirs,
  childFiles,
  classifyUnusedKeys,
  createKeyCompiler,
  isExcluded,
  keysMatchingAny,
  matchKeys,
  moreSpecificGlob,
  reportAt,
  splitNames
} from './declarations.js';

const ID = 'architecture/reserved-directory-names';
const docsUrl = docsUrlFor(ID);
const recommendation = 'Use one of the names this location declares, or add the new name to the declaration.';

// Inert by default: which names a project reserves is its own decision, and svelte-vitals never
// guesses one.
const OPTIONS: RuleOptionsSpec = {
  scopes: { kind: 'string-map', default: {} },
  unitScopes: { kind: 'string-map', default: {} },
  anyCaseUnitScopes: { kind: 'string-map', default: {} },
  exclude: { kind: 'string-list', default: [] }
};

/** The part of a filename before its first dot — `Card.svelte.ts` → `Card`. */
function stem(file: string): string {
  const dot = file.indexOf('.');
  return dot === -1 ? file : file.slice(0, dot);
}

/**
 * Whether `dir` is a unit: its name begins A–Z and one of its **immediate** children is a file whose
 * stem equals the directory's name.
 *
 * This is deliberately NOT `architecture/unit-entry-file`'s definition, which asks only about the
 * first character and then reports whether the entry file is there. Borrowing that one would make a
 * PascalCase directory missing its file — a grouping wearing the wrong name, which that rule already
 * reports once — govern its children here, so a directory of PascalCase components would produce a
 * finding per component. One naming mistake would become N findings, none naming the real problem.
 *
 * The stem is taken to the FIRST dot so that `.svelte.ts` qualifies, which means `Card/Card.test.ts`
 * qualifies too and a directory holding only a test counts as a unit. Accepted: the alternative
 * (strip a single extension) rejects a real entry-file shape, and the failure it would prevent is
 * milder than the one it introduces.
 */
export function isUnitDir(dir: string, filesIn: Map<string, string[]>): boolean {
  const first = baseName(dir).charCodeAt(0);
  return first >= 65 && first <= 90 && isAnyCaseUnitDir(dir, filesIn);
}

/**
 * `isUnitDir` without the letter test: one of `dir`'s immediate children is a file whose stem equals
 * the directory's name, whatever case the name begins with.
 *
 * The split is the letter test alone, and deliberately not the entry file's extension. That every
 * capitalised unit holds a `.svelte` and every lowercase one a `.ts` is a property of a convention,
 * not something a rule should encode.
 */
export function isAnyCaseUnitDir(dir: string, filesIn: Map<string, string[]>): boolean {
  const name = baseName(dir);
  const own = filesIn.get(dir);
  return own !== undefined && own.some((f) => stem(f) === name);
}

/** The three maps this rule compares, and the priority that breaks a byte-identical-glob tie. */
type MapKind = 'scopes' | 'unitScopes' | 'anyCaseUnitScopes';
// `scopes` has no eligibility gate at all, so wherever any unit map's glob matches, an identical
// `scopes` key matches too and must win — the same reasoning the two-map rule already recorded:
// preferring the gate-free map keeps a glob's outcome uniform instead of depending on a per-directory
// property. `unitScopes`'s gate (isUnitDir) is a strict subset of `anyCaseUnitScopes`'s (isAnyCaseUnitDir)
// — every capitalised unit is also an any-case unit — so on an identical glob `unitScopes` is the
// narrower, more specific claim and wins there too, letting one glob partition a governed name into a
// capitalised superset and an any-case subset (design 2026-08-06's worked example, ported to this rule's
// single-governing-set shape rather than that rule's union shape).
const PRIORITY = { scopes: 0, unitScopes: 1, anyCaseUnitScopes: 2 } satisfies Record<MapKind, number>;

/**
 * architecture/reserved-directory-names — a directory's immediate subdirectories may only take names
 * the project declared for that position (design 2026-07-29, extended 2026-08-08 for lowercase units —
 * issue #386).
 *
 * The option maps differ in what their keys name. A `scopes` key names the parent directly. A
 * `unitScopes` key names a root, and the rule governs the children of whichever directories beneath
 * it are units whose name begins A–Z — the shape a glob cannot reach, because units nest to arbitrary
 * depth. An `anyCaseUnitScopes` key names a root the same way, but governs units of *either* case:
 * `isUnitDir`'s letter test — A–Z plus a same-stemmed entry file, whatever its extension — excludes a
 * lowercase unit, so without this map no generic unit-map declaration governed one's children (a
 * `scopes` key naming the parent directly could still reach one) — measured at 129 of 299 units (43%)
 * on a real tree. Neither map is named with the bare word "unit": the
 * sibling rule `architecture/reserved-name-placement` records why that word alone is ambiguous between
 * the two predicates once both exist.
 *
 * There are no pass results. `computeScore` seeds every distinct `route` at 100 and averages, and the
 * subject here is a directory with no pre-existing score key, so a pass per directory would add
 * hundreds of 100s from one broad declaration and dilute every real finding.
 */
export const architectureReservedDirectoryNames: Rule = {
  id: ID,
  title: 'Reserved directory names',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    'A closed set of directory names is only worth writing down if it stays closed: one directory outside it and the table stops describing the tree, so every reader has to open a directory to learn what it holds.',
  fix: {
    description:
      'Rename the directory to a declared name, move it under one of them, or add its name to the declaration.'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const files = ctx.sourceFiles;
    if (files === undefined) return [];

    // No config layer mentions this rule, so nothing below can find a declaration. Without this,
    // an unconfigured project resolves options once per directory and throws every result away —
    // and this rule is off by default, so that is the case for almost every project.
    if (!isMentionedAnywhere(ctx.config, ID)) return [];

    const compiledOverrides = compileOverrides(ctx.config);
    const dirs = new Set<string>();
    for (const f of files) for (const d of ancestorDirs(f)) dirs.add(d);
    const kids = childDirs(dirs);
    const filesIn = childFiles(files);

    const compile = createKeyCompiler();
    // Values are parsed once per distinct string, not once per directory.
    const parsed = new Map<string, string[]>();
    const namesOf = (value: string) => {
      let n = parsed.get(value);
      if (n === undefined) parsed.set(value, (n = splitNames(value)));
      return n;
    };

    const out: Result[] = [];
    const globalOptions = resolveRuleOptions(ID, OPTIONS, ctx.config);
    const globalScopes = mapOption(globalOptions, 'scopes');
    const globalUnits = mapOption(globalOptions, 'unitScopes');
    const globalAnyUnits = mapOption(globalOptions, 'anyCaseUnitScopes');
    const globalKeys = new Set([
      ...Object.keys(globalScopes),
      ...Object.keys(globalUnits),
      ...Object.keys(globalAnyUnits)
    ]);
    const usedKeys = new Set<string>();
    // Collected so the deferred classification can tell an unmatched key from a shadowed one, and a
    // unit-map key that never met a directory of its required case from either. Neither list is
    // consulted unless some key ends the run with no work recorded.
    const excludedDirs: string[] = [];
    const nonUnitDirs: string[] = [];
    const nonAnyUnitDirs: string[] = [];
    // A glob shared between `scopes` and a unit map is a property of the options, not of the tree, and
    // is always a full collision: `scopes` has no eligibility gate, so an identical unit-map key never
    // wins anywhere it matched. A glob shared between the two unit maps is NOT automatically a
    // collision — `unitScopes`'s gate is a strict subset of `anyCaseUnitScopes`'s, so the any-case
    // entry keeps real work at any-case units the letter test excludes, which is the partition this
    // extension exists to enable. Checked against the global resolution — which catches it even when
    // no directory is ever examined — and again against each per-directory resolution, which is where
    // an `overrides` entry's contribution appears.
    const collisions = new Map<string, string>();
    const collisionMessage = (losers: string[]): string => {
      const maps = ['scopes', ...losers];
      const list = maps.length === 2 ? `both ${maps[0]} and ${maps[1]}` : maps.join(', ');
      return `declared in ${list}, so the scopes entry wins wherever ${losers.length > 1 ? 'they' : 'both'} apply`;
    };
    // The declaration identity here is the bare glob key itself — the same string the two
    // project-scoped notes below name — not a map-qualified label, because `scopes`, `unitScopes` and
    // `anyCaseUnitScopes` can all carry the same key (the #386 partition puts one glob in both unit
    // maps), and only one of them ever governs a given directory. Seeded from `globalKeys` so a
    // declaration that governs nothing reports `0` rather than vanishing from the map entirely.
    const examinedCounts: Record<string, number> = {};
    for (const key of globalKeys) examinedCounts[key] = 0;

    const noteCollisions = (
      scopesMap: Record<string, string>,
      unitMap: Record<string, string>,
      anyUnitMap: Record<string, string>
    ) => {
      for (const key of Object.keys(scopesMap)) {
        // A value naming nothing is dropped before matching, so whichever side still names something
        // governs alone and there is no contest to report — the claim below would be false. The
        // empty-value reason reports the real error instead, which it cannot do for a key that
        // already carries a note.
        if (namesOf(scopesMap[key] as string).length === 0) continue;
        const losers: string[] = [];
        if (Object.hasOwn(unitMap, key) && namesOf(unitMap[key] as string).length > 0) losers.push('unitScopes');
        if (Object.hasOwn(anyUnitMap, key) && namesOf(anyUnitMap[key] as string).length > 0) {
          losers.push('anyCaseUnitScopes');
        }
        if (losers.length > 0) collisions.set(key, collisionMessage(losers));
      }
    };
    noteCollisions(globalScopes, globalUnits, globalAnyUnits);

    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(ID, OPTIONS, ctx.config, { route: dir, file: dir }, compiledOverrides);
      const scopes = mapOption(o, 'scopes');
      const unitScopes = mapOption(o, 'unitScopes');
      const anyCaseUnitScopes = mapOption(o, 'anyCaseUnitScopes');
      if (
        Object.keys(scopes).length === 0 &&
        Object.keys(unitScopes).length === 0 &&
        Object.keys(anyCaseUnitScopes).length === 0
      ) {
        continue; // inert
      }
      noteCollisions(scopes, unitScopes, anyCaseUnitScopes);

      // Exclusion first. On the violation path this is now belt-and-braces — the per-child check
      // below consults this same resolved list against the child's ancestors, and the parent is
      // always one of them. What it is load-bearing for is the bookkeeping: `excludedDirs` is filled
      // only here, and no key may be recorded as work at a directory the rule was forbidden to look
      // at. The sibling rule had to make that same correction in review.
      const excluded = compile(listOption(o, 'exclude'));
      if (isExcluded(dir, ancestorDirs(dir), excluded)) {
        excludedDirs.push(dir);
        continue;
      }

      // A key naming nothing at all is dropped before matching, so a typo cannot win on specificity
      // and then apply an empty set — under which every child would be reported against a
      // requirement naming no name. Unit-map keys are eligible only where the directory is a unit of
      // the map's required case, which is that map's whole identification criterion.
      const liveScopes = Object.keys(scopes).filter((k) => namesOf(scopes[k] as string).length > 0);
      const isUnit = isUnitDir(dir, filesIn);
      const isAnyUnit = isAnyCaseUnitDir(dir, filesIn);
      const liveUnits = isUnit
        ? Object.keys(unitScopes).filter((k) => namesOf(unitScopes[k] as string).length > 0)
        : [];
      const liveAnyUnits = isAnyUnit
        ? Object.keys(anyCaseUnitScopes).filter((k) => namesOf(anyCaseUnitScopes[k] as string).length > 0)
        : [];
      if (!isUnit) nonUnitDirs.push(dir);
      if (!isAnyUnit) nonAnyUnitDirs.push(dir);
      const byPosition = matchKeys(dir, compile(liveScopes, true));
      const byUnit = matchKeys(dir, compile(liveUnits, true));
      const byAnyUnit = matchKeys(dir, compile(liveAnyUnits, true));
      // Recorded for every surviving match, whether or not the key won the comparison: in every case
      // the key identified the directory and a check ran.
      for (const k of byPosition.matched) if (globalKeys.has(k)) usedKeys.add(k);
      for (const k of byUnit.matched) if (globalKeys.has(k)) usedKeys.add(k);
      for (const k of byAnyUnit.matched) if (globalKeys.has(k)) usedKeys.add(k);

      // All three kinds of key match the same directory — the parent whose children are governed —
      // so their specificity is comparable and it decides, rather than one kind outranking another.
      // `moreSpecificGlob` is false in both directions only for two identical globs, which is the one
      // case it cannot settle; `PRIORITY` breaks it there.
      const candidates: { kind: MapKind; best: string; names: string[] }[] = [];
      if (byPosition.best !== undefined) {
        candidates.push({ kind: 'scopes', best: byPosition.best, names: namesOf(scopes[byPosition.best] as string) });
      }
      if (byUnit.best !== undefined) {
        candidates.push({
          kind: 'unitScopes',
          best: byUnit.best,
          names: namesOf(unitScopes[byUnit.best] as string)
        });
      }
      if (byAnyUnit.best !== undefined) {
        candidates.push({
          kind: 'anyCaseUnitScopes',
          best: byAnyUnit.best,
          names: namesOf(anyCaseUnitScopes[byAnyUnit.best] as string)
        });
      }
      let winner: (typeof candidates)[number] | undefined;
      for (const c of candidates) {
        if (winner === undefined || moreSpecificGlob(c.best, winner.best)) {
          winner = c;
        } else if (!moreSpecificGlob(winner.best, c.best) && PRIORITY[c.kind] < PRIORITY[winner.kind]) {
          winner = c;
        }
      }
      if (winner === undefined) continue;

      // Only the winning key is judged here: a losing candidate matched this directory but governed
      // nothing at it, and the count answers "how many places did this declaration govern" — an
      // `overrides`-only winner is excluded, matching the diagnostics above, which classify only
      // globally resolved declarations.
      if (globalKeys.has(winner.best)) examinedCounts[winner.best] = (examinedCounts[winner.best] ?? 0) + 1;

      const allowed = new Set(winner.names);
      for (const child of kids.get(dir) ?? []) {
        if (allowed.has(baseName(child))) continue;
        // Both the parent's resolved exclusions and the child's own. An `overrides` entry scoped to
        // the parent can name a child, and the child's own resolution would not see that entry at
        // all — its scope does not match the child's path. Checking only one list makes `exclude`
        // mean "and everything beneath it" for the config file but not for an override.
        if (isExcluded(child, ancestorDirs(child), excluded)) continue;
        // The child's own exclusion, resolved separately: an `overrides` entry can prune the child
        // specifically, and the parent's resolved list would not show it. Only reached for a
        // violation candidate, so the cost is per finding rather than per directory.
        const childOptions = resolveRuleOptions(
          ID,
          OPTIONS,
          ctx.config,
          { route: child, file: child },
          compiledOverrides
        );
        if (isExcluded(child, ancestorDirs(child), compile(listOption(childOptions, 'exclude')))) continue;

        const at = reportAt(child, files);
        if (at === undefined) continue; // unreachable: the directory came from a file's prefix
        // `route` is the offending directory, `location` a file inside it. `location` must be a path
        // git lists as changed or `filterToChangedFiles` drops the finding from every `--diff` run,
        // and git never lists a directory; `route` carries the directory so that two findings
        // resolving to the same file keep distinct `findingKey`s (`id::route::location`).
        out.push({
          id: ID,
          category: 'architecture',
          severity: 'info',
          detection: { presence: 'none', value: 'absent' },
          route: child,
          location: at,
          message: `${child} is not one of the names declared here: ${winner.names.join(', ')}.`,
          recommendation,
          docsUrl,
          fix: {
            description: 'Rename it to a declared name, move it under one of them, or add its name to the declaration.'
          }
        });
      }
    }

    // One finding carrying every declaration that is not checking what it says. `findingKey`
    // (`id::route::location`, packages/cli/src/baseline.ts) leaves both fields unset for every
    // project-scoped result, so N separate findings would collapse to one baseline entry and
    // suppressing one would silently suppress the rest.
    //
    // The two options-derived reasons are decided FIRST. A key they name has no recorded work by
    // construction — a colliding entry never governs, and a key naming nothing is dropped before
    // matching — so feeding either to the traversal classification would label a configuration
    // contradiction "matched no directory".
    const notes = new Map<string, string>();
    for (const [key, message] of collisions) notes.set(key, message);
    for (const key of globalKeys) {
      if (notes.has(key)) continue;
      // Every map, not whichever holds the key first. A key present in more than one with one empty
      // value is exactly the case the collision check declines, and reading only one side would leave
      // it with no note at all when another side is doing real work — `usedKeys` absorbs the key and
      // the unused classification below never sees it either.
      const scopesEmpty = Object.hasOwn(globalScopes, key) && namesOf(globalScopes[key] as string).length === 0;
      const unitsEmpty = Object.hasOwn(globalUnits, key) && namesOf(globalUnits[key] as string).length === 0;
      const anyUnitsEmpty = Object.hasOwn(globalAnyUnits, key) && namesOf(globalAnyUnits[key] as string).length === 0;
      if (scopesEmpty || unitsEmpty || anyUnitsEmpty) {
        notes.set(key, 'names no directory name at all');
      }
    }

    const unused = [...globalKeys].filter((k) => !notes.has(k) && !usedKeys.has(k));
    // A unit-map-only key is recorded solely by matching a directory of its required case, so one
    // that matched only directories of the wrong case (or no unit at all) identified nothing. That is
    // the same distinction `pascalCaseUnits` draws in `architecture/unit-entry-file`, where the casing
    // gate is the identification criterion; here the gate is the unit test. Decided before the
    // excluded/unmatched split, so an exclusion is never blamed for a key a unit test disqualified.
    //
    // `anyCaseUnitScopes` is checked first: its gate (isAnyCaseUnitDir) is the weaker of the two, so a
    // key that fails it has also failed `unitScopes`'s gate, and the stronger, more informative "never
    // a unit of either case" note should win over the narrower "never a unit" one when both maps share
    // a glob (design 2026-08-06's partition, ported here) and neither is doing any work.
    const anyUnitOnly = unused.filter((k) => Object.hasOwn(globalAnyUnits, k) && !Object.hasOwn(globalScopes, k));
    for (const key of keysMatchingAny(anyUnitOnly, nonAnyUnitDirs, compile)) {
      notes.set(key, 'matched directories but never a unit of either case');
    }
    const unitOnly = unused.filter(
      (k) => Object.hasOwn(globalUnits, k) && !Object.hasOwn(globalScopes, k) && !notes.has(k)
    );
    for (const key of keysMatchingAny(unitOnly, nonUnitDirs, compile)) {
      notes.set(key, 'matched directories but never a unit');
    }
    for (const [key, reason] of classifyUnusedKeys(
      unused.filter((k) => !notes.has(k)),
      excludedDirs,
      compile
    )) {
      notes.set(key, reason === 'only-excluded' ? 'matched only excluded directories' : 'matched no directory');
    }

    const reported = [...notes.keys()].sort();
    if (reported.length > 0) {
      const message =
        reported.length === 1
          ? `The declaration '${reported[0]}' does not check what it says: ${notes.get(reported[0] as string)}.`
          : `These declarations do not check what they say: ${reported.map((k) => `'${k}' (${notes.get(k)})`).join(', ')}.`;
      out.push({
        id: ID,
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message,
        recommendation: 'Correct the glob or the names, or remove the declaration.',
        docsUrl
      });
    }
    ctx.recordExamined?.(examinedCounts);
    return out;
  }
};
