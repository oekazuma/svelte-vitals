import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import { listOption, mapOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
import { ancestorDirs, baseName, createKeyCompiler, matchKeys, reportAt } from './declarations.js';

const docsUrl = docsUrlFor('architecture/unit-entry-file');
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
  id: 'architecture/unit-entry-file',
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

    // Hoisted: compiling every override's globs once, not once per directory.
    const compiledOverrides = compileOverrides(ctx.config);

    // Every ancestor prefix of every file — so a directory whose only children are
    // directories is in the set. Sorted for deterministic output.
    const dirs = new Set<string>();
    for (const f of files) for (const d of ancestorDirs(f)) dirs.add(d);
    const fileSet = new Set(files);

    // One cache per run. `bareGuard` is true for `units` and `pascalCaseUnits` alike (see
    // `matchKeys` in ./declarations.ts for why both need it, and why `exclude` must never set it).
    const compile = createKeyCompiler();

    const out: Result[] = [];
    // Keys of the globally declared options that matched at least one directory.
    const globalOptions = resolveRuleOptions('architecture/unit-entry-file', OPTIONS, ctx.config);
    const globalKeys = new Set([
      ...Object.keys(mapOption(globalOptions, 'units')),
      ...Object.keys(mapOption(globalOptions, 'pascalCaseUnits'))
    ]);
    const usedKeys = new Set<string>();

    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(
        'architecture/unit-entry-file',
        OPTIONS,
        ctx.config,
        { route: dir, file: dir },
        compiledOverrides
      );
      const units = mapOption(o, 'units');
      const pascalUnits = mapOption(o, 'pascalCaseUnits');
      if (Object.keys(units).length === 0 && Object.keys(pascalUnits).length === 0) continue; // inert

      const byPath = matchKeys(dir, compile(Object.keys(units), true));
      const byCasing = matchKeys(dir, compile(Object.keys(pascalUnits), true));

      // `units`: matched unconditionally, before `exclude` prunes the directory and before the
      // casing gate below decides whether `pascalCaseUnits` gets to set `ext` here. A key that
      // only ever matches an excluded directory, or only matches directories a `units` key
      // already won for, has still done work: every key that matched has done work, whether or
      // not it won the tie-break (same principle as the tie-break case just below), so
      // bookkeeping it after either gate would falsely call it inert.
      for (const k of byPath.matched) if (globalKeys.has(k)) usedKeys.add(k);

      // `pascalCaseUnits` is different in kind, not degree: for `units`, the casing gate plays no
      // role at all, so marking it unconditionally is correct. For `pascalCaseUnits`, the casing
      // gate below IS the identification criterion — a directory is never a pascalCaseUnits unit
      // unless its basename is PascalCase — so a key that matched only non-PascalCase directories
      // has identified nothing and done no work, regardless of `exclude`. A key like
      // `'src/lib/components'` (missing the trailing `/**` a project meant to write) can match one
      // real, lowercase directory; treating that match as "used" would hide exactly the typo the
      // inert-declaration finding exists to surface.
      if (isPascalCase(baseName(dir))) {
        for (const k of byCasing.matched) if (globalKeys.has(k)) usedKeys.add(k);
      }

      // `exclude` outranks both declarations, and prunes the whole subtree: a directory is
      // exempt when it or any ancestor matches. Hoisted out of the `.some()` below: it does not
      // depend on which exclude glob is being tested, so re-deriving it once per glob was waste.
      const excluded = compile(listOption(o, 'exclude'));
      const ancestors = ancestorDirs(dir);
      if (excluded.some(({ re }) => re.test(dir) || ancestors.some((a) => re.test(a)))) continue;

      // A `units` key wins over the casing convention purely by being tried first.
      let ext = byPath.best === undefined ? undefined : units[byPath.best];
      const viaUnits = ext !== undefined;
      if (ext === undefined && isPascalCase(baseName(dir))) {
        ext = byCasing.best === undefined ? undefined : pascalUnits[byCasing.best];
      }
      if (ext === undefined) continue;

      const expected = `${dir}/${baseName(dir)}${ext}`;
      if (fileSet.has(expected)) {
        out.push({
          id: 'architecture/unit-entry-file',
          category: 'architecture',
          severity: 'info',
          detection: { presence: 'own', value: 'static' },
          route: expected,
          message: 'Unit entry file',
          recommendation,
          docsUrl
        });
        continue;
      }

      const at = reportAt(dir, files);
      if (at === undefined) continue; // unreachable: the directory came from a file's prefix
      out.push({
        id: 'architecture/unit-entry-file',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        route: at,
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
      const message =
        inertKeys.length === 1
          ? `The declaration '${inertKeys[0]}' matched no directory, so it checks nothing.`
          : `These declarations matched no directory, so they check nothing: ${inertKeys.map((k) => `'${k}'`).join(', ')}.`;
      out.push({
        id: 'architecture/unit-entry-file',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message,
        recommendation: 'Correct the glob, or remove the declaration.',
        docsUrl
      });
    }
    return out;
  }
};
