import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import { listOption, mapOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
import {
  ancestorDirs,
  baseName,
  childDirs,
  childFiles,
  createKeyCompiler,
  isExcluded,
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
    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(ID, OPTIONS, ctx.config, { route: dir, file: dir }, compiledOverrides);
      const scopes = mapOption(o, 'scopes');
      const unitScopes = mapOption(o, 'unitScopes');
      if (Object.keys(scopes).length === 0 && Object.keys(unitScopes).length === 0) continue; // inert

      // Exclusion first: an excluded directory is one this rule is forbidden to look at.
      const excluded = compile(listOption(o, 'exclude'));
      if (isExcluded(dir, ancestorDirs(dir), excluded)) continue;

      // A key naming nothing at all is dropped before matching, so a typo cannot win on specificity
      // and then apply an empty set — under which every child would be reported against a
      // requirement naming no name. `unitScopes` keys are eligible only where the directory is a
      // unit, which is that map's whole identification criterion.
      const liveScopes = Object.keys(scopes).filter((k) => namesOf(scopes[k] as string).length > 0);
      const liveUnits = isUnitDir(dir, filesIn)
        ? Object.keys(unitScopes).filter((k) => namesOf(unitScopes[k] as string).length > 0)
        : [];
      const byPosition = matchKeys(dir, compile(liveScopes, true));
      const byUnit = matchKeys(dir, compile(liveUnits, true));

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
    return out;
  }
};
