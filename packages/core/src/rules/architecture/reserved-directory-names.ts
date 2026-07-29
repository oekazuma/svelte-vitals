import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import { listOption, mapOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
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
  const name = baseName(dir);
  const first = name.charCodeAt(0);
  if (!(first >= 65 && first <= 90)) return false;
  const own = filesIn.get(dir);
  return own !== undefined && own.some((f) => stem(f) === name);
}

/**
 * architecture/reserved-directory-names — a directory's immediate subdirectories may only take names
 * the project declared for that position (design 2026-07-29). L3: inert until a scope is declared.
 *
 * Two option maps, differing in what their key names. A `scopes` key names the parent directly. A
 * `unitScopes` key names a root, and the rule governs the children of whichever directories beneath
 * it are units — the shape a glob cannot reach, because units nest to arbitrary depth.
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
    const globalKeys = new Set([...Object.keys(globalScopes), ...Object.keys(globalUnits)]);
    const usedKeys = new Set<string>();
    // Collected so the deferred classification can tell an unmatched key from a shadowed one, and a
    // `unitScopes` key that never met a unit from either. Neither list is consulted unless some key
    // ends the run with no work recorded.
    const excludedDirs: string[] = [];
    const nonUnitDirs: string[] = [];
    // A glob in both maps is a property of the options, not of the tree. Checked against the global
    // resolution — which catches it even when no directory is examined — and against each
    // per-directory resolution, which is where an `overrides` entry's contribution appears.
    // Not restricted to `globalKeys`, unlike the inertness check below. A collision is a property of
    // the resolved option keys and needs no intersection with the directory set, so it is reported
    // even when both halves arrive from an `overrides` entry — which is the likeliest way it happens.
    const collisions = new Set<string>();
    const noteCollisions = (a: Record<string, string>, b: Record<string, string>) => {
      for (const key of Object.keys(a)) if (Object.hasOwn(b, key)) collisions.add(key);
    };
    noteCollisions(globalScopes, globalUnits);

    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(ID, OPTIONS, ctx.config, { route: dir, file: dir }, compiledOverrides);
      const scopes = mapOption(o, 'scopes');
      const unitScopes = mapOption(o, 'unitScopes');
      if (Object.keys(scopes).length === 0 && Object.keys(unitScopes).length === 0) continue; // inert
      noteCollisions(scopes, unitScopes);

      // Exclusion first: an excluded directory is one this rule is forbidden to look at.
      const excluded = compile(listOption(o, 'exclude'));
      if (isExcluded(dir, ancestorDirs(dir), excluded)) {
        excludedDirs.push(dir);
        continue;
      }

      // A key naming nothing at all is dropped before matching, so a typo cannot win on specificity
      // and then apply an empty set — under which every child would be reported against a
      // requirement naming no name. `unitScopes` keys are eligible only where the directory is a
      // unit, which is that map's whole identification criterion.
      const liveScopes = Object.keys(scopes).filter((k) => namesOf(scopes[k] as string).length > 0);
      const isUnit = isUnitDir(dir, filesIn);
      const liveUnits = isUnit
        ? Object.keys(unitScopes).filter((k) => namesOf(unitScopes[k] as string).length > 0)
        : [];
      if (!isUnit) nonUnitDirs.push(dir);
      const byPosition = matchKeys(dir, compile(liveScopes, true));
      const byUnit = matchKeys(dir, compile(liveUnits, true));
      // Recorded for every surviving match, whether or not the key won the comparison: in both
      // cases the key identified the directory and a check ran.
      for (const k of byPosition.matched) if (globalKeys.has(k)) usedKeys.add(k);
      for (const k of byUnit.matched) if (globalKeys.has(k)) usedKeys.add(k);

      // Both kinds of key match the same directory — the parent whose children are governed — so
      // their specificity is comparable and it decides, rather than one kind outranking the other.
      // `moreSpecificGlob` is false in both directions only for two identical globs, since its last
      // step is lexicographic on the whole key; that is the one case it cannot settle, and it falls
      // to `scopes` because `scopes` applies to every directory its key matches while `unitScopes`
      // applies only to the ones that are units — so preferring it keeps a single glob's outcome
      // uniform across its matches.
      let governing: string[] | undefined;
      if (byPosition.best !== undefined && byUnit.best !== undefined) {
        governing = moreSpecificGlob(byUnit.best, byPosition.best)
          ? namesOf(unitScopes[byUnit.best] as string)
          : namesOf(scopes[byPosition.best] as string);
      } else if (byPosition.best !== undefined) {
        governing = namesOf(scopes[byPosition.best] as string);
      } else if (byUnit.best !== undefined) {
        governing = namesOf(unitScopes[byUnit.best] as string);
      }
      if (governing === undefined) continue;

      const allowed = new Set(governing);
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
          message: `${child} is not one of the names declared here: ${governing.join(', ')}.`,
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
    // construction — a colliding `unitScopes` entry never governs, and a key naming nothing is
    // dropped before matching — so feeding either to the traversal classification would label a
    // configuration contradiction "matched no directory".
    const notes = new Map<string, string>();
    for (const key of collisions) {
      notes.set(key, 'declared in both scopes and unitScopes, so the unitScopes entry never applies');
    }
    for (const key of globalKeys) {
      if (notes.has(key)) continue;
      const value = globalScopes[key] ?? globalUnits[key];
      if (value !== undefined && namesOf(value).length === 0) {
        notes.set(key, 'names no directory name at all');
      }
    }

    const unused = [...globalKeys].filter((k) => !notes.has(k) && !usedKeys.has(k));
    // A `unitScopes`-only key is recorded solely by matching a unit, so one that matched a non-unit
    // and nothing else identified nothing. That is the same distinction `pascalCaseUnits` draws in
    // `architecture/unit-entry-file`, where the casing gate is the identification criterion; here
    // the gate is the unit test. Decided before the excluded/unmatched split, so an exclusion is
    // never blamed for a key the unit test disqualified.
    // This ordering is also what keeps the excluded label honest, and is why no separate
    // "matched something surviving" set is needed here. `usedKeys` is narrower than "matched a
    // surviving directory" — a `unitScopes` key is never recorded at a non-unit — so feeding such a
    // key straight to `classifyUnusedKeys` could blame an exclusion whose removal changes nothing.
    // Claiming the non-unit reason first removes the key from that pass entirely.
    const unitOnly = unused.filter((k) => Object.hasOwn(globalUnits, k) && !Object.hasOwn(globalScopes, k));
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
    return out;
  }
};
