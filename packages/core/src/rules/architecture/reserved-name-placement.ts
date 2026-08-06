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
  childFiles,
  createKeyCompiler,
  isExcluded,
  matchKeys,
  reportAt,
  splitNames
} from './declarations.js';
import { isAnyCaseUnitDir, isUnitDir } from './reserved-directory-names.js';

const ID = 'architecture/reserved-name-placement';
const docsUrl = docsUrlFor(ID);
const recommendation = 'Move it to one of the places declared for this name, or declare this place for it.';
const fixDescription =
  'Move the directory to one of the places declared for its name, rename it, or declare this place for the name.';

// Inert by default: which names a project reserves, and where each may sit, is its own decision.
const OPTIONS: RuleOptionsSpec = {
  placements: { kind: 'string-map', default: {} },
  capitalisedUnitPlacements: { kind: 'string-map', default: {} },
  anyCaseUnitPlacements: { kind: 'string-map', default: {} },
  exclude: { kind: 'string-list', default: [] }
};

/** The directory holding `dir`, or undefined when `dir` sits at the root. */
function parentOf(dir: string): string | undefined {
  const cut = dir.lastIndexOf('/');
  return cut === -1 ? undefined : dir.slice(0, cut);
}

/**
 * architecture/reserved-name-placement — a reserved directory name may appear only in the places
 * declared for it (design 2026-08-06). L3: inert until a placement is declared.
 *
 * The sibling `architecture/reserved-directory-names` says "at this position, only these names"; it
 * cannot say "this name, only at these positions", which for a name appearing in several kinds of
 * place is what a convention actually states.
 *
 * All three maps match the same directory — the reserved-name directory's parent — and differ only in
 * what else they require of it: nothing, that it is a capitalised unit, that it is a unit of either
 * case. A name's permitted positions are the UNION of its entries across the three, because a real
 * convention permits one name under a unit, under a grouping and under a route directory at once.
 *
 * There are no pass results, for the reason the sibling records: `computeScore` seeds every distinct
 * `route` at 100 and averages, and a directory has no pre-existing score key.
 */
export const architectureReservedNamePlacement: Rule = {
  id: ID,
  title: 'Reserved name placement',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    'A name reserved for one kind of place stops carrying that meaning the moment it appears somewhere else: a reader who has met one exception has to open the directory to learn what it holds.',
  fix: {
    description: fixDescription
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const files = ctx.sourceFiles;
    if (files === undefined) return []; // --route runs build no inventory

    // No config layer mentions this rule, so nothing below can find a declaration. Without this, an
    // unconfigured project resolves options once per directory and throws every result away.
    if (!isMentionedAnywhere(ctx.config, ID)) return [];

    const compiledOverrides = compileOverrides(ctx.config);
    const dirs = new Set<string>();
    for (const f of files) for (const d of ancestorDirs(f)) dirs.add(d);
    const filesIn = childFiles(files);

    const compile = createKeyCompiler();
    // Values are parsed once per distinct string, not once per directory.
    const parsed = new Map<string, string[]>();
    const globsOf = (value: string) => {
      let g = parsed.get(value);
      if (g === undefined) parsed.set(value, (g = splitNames(value)));
      return g;
    };

    const out: Result[] = [];

    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(ID, OPTIONS, ctx.config, { route: dir, file: dir }, compiledOverrides);
      const placements = mapOption(o, 'placements');
      const capUnits = mapOption(o, 'capitalisedUnitPlacements');
      const anyUnits = mapOption(o, 'anyCaseUnitPlacements');
      if (
        Object.keys(placements).length === 0 &&
        Object.keys(capUnits).length === 0 &&
        Object.keys(anyUnits).length === 0
      ) {
        continue; // inert
      }

      const name = baseName(dir);
      const inPlacements = Object.hasOwn(placements, name);
      const inCapUnits = Object.hasOwn(capUnits, name);
      const inAnyUnits = Object.hasOwn(anyUnits, name);
      if (!inPlacements && !inCapUnits && !inAnyUnits) continue;

      const excluded = compile(listOption(o, 'exclude'));
      if (isExcluded(dir, ancestorDirs(dir), excluded)) continue;

      const parent = parentOf(dir);
      if (parent === undefined) continue;

      // The union: any one map permitting the position is enough. All three globs are matched against
      // the same directory — this parent — and differ only in what else they require of it.
      const matches = (value: string | undefined) =>
        value !== undefined && matchKeys(parent, compile(globsOf(value), true)).matched.length > 0;
      const permitted =
        matches(placements[name]) ||
        (isUnitDir(parent, filesIn) && matches(capUnits[name])) ||
        (isAnyCaseUnitDir(parent, filesIn) && matches(anyUnits[name]));
      if (permitted) continue;

      const at = reportAt(dir, files);
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
        route: dir,
        location: at,
        message: `${dir} is not one of the places declared for '${name}'.`,
        recommendation,
        docsUrl,
        fix: {
          description: fixDescription
        }
      });
    }

    return out;
  }
};
