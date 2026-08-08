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
  classifyUnusedKeys,
  createKeyCompiler,
  isExcluded,
  matchKeys,
  reportAt
} from './declarations.js';

const ID = 'architecture/unit-entry-file';
const docsUrl = docsUrlFor(ID);
const recommendation =
  'Give every declared unit directory a file named after it, or stop declaring that directory a unit.';

// Inert by default: with nothing declared there is no convention to check, and
// svelte-vitals never guesses which directories a project treats as units.
const OPTIONS: RuleOptionsSpec = {
  units: { kind: 'string-map', default: {} },
  pascalCaseUnits: { kind: 'string-map', default: {} },
  exclude: { kind: 'string-list', default: [] }
};

/** A PascalCase name is one whose first character is A-Z. That is the whole definition. */
function isPascalCase(name: string): boolean {
  const c = name.charCodeAt(0);
  return c >= 65 && c <= 90;
}

/**
 * architecture/unit-entry-file — a directory declared to be a unit must contain a file named
 * after it (design 2026-07-28). L3: the declarations come from the project's own `units`,
 * `pascalCaseUnits` and `exclude` options and are never inferred, so the rule is inert until then.
 *
 * The directory set is every ancestor path prefix of every file, so a directory holding only
 * subdirectories is checked too. Violations report at a file inside the directory rather than at
 * the directory, because `filterToChangedFiles` keeps only locations git lists as changed.
 */
export const architectureUnitEntryFile: Rule = {
  id: ID,
  title: 'Unit entry file',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    "A directory named after a unit but missing that unit's entry file is either an incomplete unit or a grouping wearing the wrong name; either way the tree no longer says what it means, and tooling that resolves by convention starts guessing.",
  fix: {
    description:
      'Make the directory and its entry file agree — add the entry file, or stop declaring this directory a unit.'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const files = ctx.sourceFiles;
    if (files === undefined) return [];

    // No config layer mentions this rule, so nothing below can find a declaration. Without this,
    // an unconfigured project resolves options once per directory and throws every result away —
    // and this rule is off by default, so that is the case for almost every project.
    if (!isMentionedAnywhere(ctx.config, ID)) return [];

    // Hoisted: compiling every override's globs once, not once per directory.
    const compiledOverrides = compileOverrides(ctx.config);

    // Every ancestor prefix of every file — so a directory whose only children are
    // directories is in the set. Sorted for deterministic output.
    const dirs = new Set<string>();
    for (const f of files) for (const d of ancestorDirs(f)) dirs.add(d);
    const fileSet = new Set(files);

    // One cache per run. `bareGuard` is true for `units` and `pascalCaseUnits` alike (see
    // `createKeyCompiler` and `matchKeys` in ./declarations.ts for why both need it, and why
    // `exclude` must never set it).
    const compile = createKeyCompiler();

    const out: Result[] = [];
    // Keys of the globally declared options that matched at least one directory.
    const globalOptions = resolveRuleOptions(ID, OPTIONS, ctx.config);
    const globalKeys = new Set([
      ...Object.keys(mapOption(globalOptions, 'units')),
      ...Object.keys(mapOption(globalOptions, 'pascalCaseUnits'))
    ]);
    const usedKeys = new Set<string>();
    // Declaration identity is the bare glob key, one shared namespace across both maps (matching
    // `globalKeys` and the inert-declaration diagnostic below). Seeded so a declaration that judges no
    // unit reports `0` rather than vanishing from the map entirely.
    const examinedCounts: Record<string, number> = {};
    for (const key of globalKeys) examinedCounts[key] = 0;
    // Paths skipped as excluded, kept only so an unused key can be told apart from a shadowed one
    // at the end of the run. Never consulted unless some key ends with no work recorded.
    const excludedDirs: string[] = [];
    // Keys that matched a directory `exclude` did not prune, whether or not they went on to do
    // identifying work. Only used to keep the annotation honest below: `usedKeys` is narrower for
    // `pascalCaseUnits`, where the casing gate is the identification criterion, so a key can be
    // absent from `usedKeys` yet have matched real, surviving directories.
    const matchedSurviving = new Set<string>();

    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(ID, OPTIONS, ctx.config, { route: dir, file: dir }, compiledOverrides);
      const units = mapOption(o, 'units');
      const pascalUnits = mapOption(o, 'pascalCaseUnits');
      if (Object.keys(units).length === 0 && Object.keys(pascalUnits).length === 0) continue; // inert

      // `exclude` outranks both declarations and prunes the whole subtree: a directory is exempt
      // when it or any ancestor matches. Tested BEFORE any key is matched against this directory.
      // An excluded directory is one the rule is forbidden to look at, so a key whose every match
      // lands here has evaluated nothing and must not be recorded as having done work — that is a
      // declaration silently cancelled by an exclusion, which is precisely what the
      // project-scoped finding below exists to surface.
      const excluded = compile(listOption(o, 'exclude'));
      const ancestors = ancestorDirs(dir);
      if (isExcluded(dir, ancestors, excluded)) {
        excludedDirs.push(dir);
        continue;
      }

      const byPath = matchKeys(dir, compile(Object.keys(units), true));
      const byCasing = matchKeys(dir, compile(Object.keys(pascalUnits), true));

      // `units`: recorded for every surviving match, before the casing gate below decides whether
      // `pascalCaseUnits` gets to set `ext` here, and whether or not the key won the tie-break. A
      // key that only ever matches directories a `units` key already won for has still identified
      // them, so recording it after the tie-break would falsely call it inert.
      for (const k of byPath.matched) if (globalKeys.has(k)) usedKeys.add(k);
      for (const k of byPath.matched) if (globalKeys.has(k)) matchedSurviving.add(k);

      // `pascalCaseUnits` is different in kind, not degree: for `units` the casing gate plays no
      // role at all, so recording every surviving match is correct. For `pascalCaseUnits` the
      // casing gate IS the identification criterion — a directory is never a pascalCaseUnits unit
      // unless its basename is PascalCase — so a key that matched only non-PascalCase directories
      // has identified nothing. A key like `'src/lib/components'` (missing the trailing `/**` a
      // project meant to write) can match one real, lowercase directory; treating that as "used"
      // would hide exactly the typo this finding exists to surface. `matchedSurviving` is recorded
      // regardless of the gate, precisely so a key disqualified by it is never blamed on `exclude`.
      for (const k of byCasing.matched) if (globalKeys.has(k)) matchedSurviving.add(k);
      if (isPascalCase(baseName(dir))) {
        for (const k of byCasing.matched) if (globalKeys.has(k)) usedKeys.add(k);
      }

      // A `units` key wins over the casing convention purely by being tried first.
      let ext = byPath.best === undefined ? undefined : units[byPath.best];
      const viaUnits = ext !== undefined;
      if (ext === undefined && isPascalCase(baseName(dir))) {
        ext = byCasing.best === undefined ? undefined : pascalUnits[byCasing.best];
      }
      if (ext === undefined) continue;

      // Whichever key actually supplied `ext` is the one that judged this directory — the other
      // map's key, if it also matched, did not, since `units` wins outright over `pascalCaseUnits`
      // rather than the two competing on specificity.
      const winningKey = viaUnits ? byPath.best : byCasing.best;
      if (winningKey !== undefined && globalKeys.has(winningKey)) {
        examinedCounts[winningKey] = (examinedCounts[winningKey] ?? 0) + 1;
      }

      const expected = `${dir}/${baseName(dir)}${ext}`;
      if (fileSet.has(expected)) {
        // No `route`: `computeScore` seeds its denominator only from results that carry one, and a plain
        // `.ts` entry is a key no other rule produces — so a pass here used to invent a fresh 100 per
        // conforming unit and dilute every real finding. `location` stays, because it keeps each pass a
        // distinct `findingKey` and keeps it visible to `--diff` filtering, and plays no part in scoring.
        out.push({
          id: ID,
          category: 'architecture',
          severity: 'info',
          detection: { presence: 'own', value: 'static' },
          location: expected,
          message: 'Unit entry file',
          recommendation,
          docsUrl
        });
        continue;
      }

      const at = reportAt(dir, files);
      if (at === undefined) continue; // unreachable: the directory came from a file's prefix
      // `route` is the directory, `location` a file inside it — the two differ on purpose. A
      // finding needs `location` to be a file git can list as changed, or `filterToChangedFiles`
      // drops it from every `--diff` run, and git never lists a directory. But a directory with no
      // direct child falls back to a file in its subtree (see `reportAt`), and a directory nested
      // inside it can resolve to that very same file — one falling back to the subtree, the other
      // taking it as a direct child. Keying `route` on that shared file would make `findingKey`
      // (`id::route::location`, packages/cli/src/baseline.ts) identical for both, so baselining or
      // suppressing either would silently take both. Keying `route` on the directory instead keeps
      // every violation's identity distinct, and costs nothing else: no consumer here reads `route`
      // as a file.
      out.push({
        id: ID,
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        route: dir,
        location: at,
        message: `${dir} declares a unit but has no ${expected}`,
        recommendation,
        docsUrl,
        // Which declaration matched decides the wording: a `units` match like functions/getFoo/
        // is already camelCase, so telling its author to rename it would be nonsense.
        fix: {
          description: viaUnits
            ? `Add ${baseName(dir)}${ext} to this directory, or remove it from the units declaration.`
            : `Add the same-named entry file, or rename the directory to camelCase if it is a grouping.`
        }
      });
    }

    // A declaration that matched nothing checks nothing — the failure this rule exists to
    // surface. Two deliberate narrowings: only globally declared keys are checked, since
    // whether an `overrides`-only key matched anything depends on intersecting its scope with
    // the directory set; and `exclude` globs are not checked at all, because an exclusion that
    // matches nothing fails LOUDLY — you get findings you did not want and notice — while a
    // unit declaration that matches nothing fails silently, which is the whole point here.
    //
    // All inert keys are folded into ONE finding rather than one per key. `findingKey`
    // (`id::route::location`, packages/cli/src/baseline.ts) is built from those three fields, and
    // every shape here leaves `route` and `location` unset — this is the first rule in the
    // repository to emit more than one project-scoped result per run, so distinct findings that
    // collapse to the same baseline/suppression key is a new problem. Emitting one finding removes
    // the collision entirely (suppressing "these declarations check nothing" is one decision, not
    // N), without touching baseline.ts or suppressions.ts, which are shared with every other rule.
    // Sorted so the message is deterministic.
    const inertKeys = [...globalKeys].filter((key) => !usedKeys.has(key)).sort();
    if (inertKeys.length > 0) {
      // Only a key that matched nothing surviving can be blamed on `exclude`: one that matched a
      // real, non-excluded directory and was disqualified by the casing gate instead is inert for
      // a reason `exclude` has nothing to do with, and removing the exclusion would not help it.
      const shadowed = inertKeys.filter((k) => !matchedSurviving.has(k));
      const reasons = classifyUnusedKeys(shadowed, excludedDirs, compile);
      const why = (k: string) =>
        reasons.get(k) === 'only-excluded' ? 'matched only excluded directories' : 'matched no directory';
      const message =
        inertKeys.length === 1
          ? `The declaration '${inertKeys[0]}' ${why(inertKeys[0] as string)}, so it checks nothing.`
          : `These declarations check nothing: ${inertKeys.map((k) => `'${k}' (${why(k)})`).join(', ')}.`;
      out.push({
        id: ID,
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message,
        recommendation: 'Correct the glob, or remove the declaration.',
        docsUrl
      });
    }
    ctx.recordExamined?.(examinedCounts);
    return out;
  }
};
