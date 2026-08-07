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
  keysMatchingAny,
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
    if (files === undefined) return []; // a --route run builds no file inventory

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

    // An alternative is identified by the map it came from, the name, and the glob — the same glob
    // under two names is two declarations, and under two maps two more, because the predicate that
    // qualifies it differs. Counting per name instead would miss a typo among good alternatives:
    // the permitted set shrinks while "some glob for this name matched" stays true.
    type MapName = 'placements' | 'capitalisedUnitPlacements' | 'anyCaseUnitPlacements';
    const label = (map: MapName, name: string, glob: string) => `${map}.${name} → ${glob}`;

    const globalOptions = resolveRuleOptions(ID, OPTIONS, ctx.config);
    const globalMaps: Record<MapName, Record<string, string>> = {
      placements: mapOption(globalOptions, 'placements'),
      capitalisedUnitPlacements: mapOption(globalOptions, 'capitalisedUnitPlacements'),
      anyCaseUnitPlacements: mapOption(globalOptions, 'anyCaseUnitPlacements')
    };
    // Only globally resolved alternatives are classified: a value arriving solely from an `overrides`
    // layer governs a subtree and cannot be judged dead against the whole tree.
    const globalAlternatives = new Map<string, { map: MapName; glob: string }>();
    const emptyNames = new Map<string, string>();
    for (const map of Object.keys(globalMaps) as MapName[]) {
      for (const [name, value] of Object.entries(globalMaps[map])) {
        const globs = globsOf(value);
        if (globs.length === 0) {
          emptyNames.set(`${map}.${name}`, 'names no position at all');
          continue;
        }
        for (const glob of globs) globalAlternatives.set(label(map, name, glob), { map, glob });
      }
    }

    const usedAlternatives = new Set<string>();

    const allDirs = [...dirs].sort();
    for (const dir of allDirs) {
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

      // A value that splits to nothing ungoverns the NAME, in every map of this resolved option set.
      // Dropping only the empty value would shrink the union and turn a typo into false positives at
      // every position the emptied entry covered — the opposite direction from the sibling rule,
      // whose maps compete rather than union.
      const emptyValue = (present: boolean, value: string | undefined) => present && globsOf(value ?? '').length === 0;
      if (
        emptyValue(inPlacements, placements[name]) ||
        emptyValue(inCapUnits, capUnits[name]) ||
        emptyValue(inAnyUnits, anyUnits[name])
      ) {
        continue;
      }

      const excluded = compile(listOption(o, 'exclude'));
      const parent = parentOf(dir);
      if (parent === undefined) continue; // a root-level directory has no parent to record

      if (isExcluded(dir, ancestorDirs(dir), excluded)) {
        continue;
      }

      // The union: any one map permitting the position is enough. All three globs are matched against
      // the same directory — this parent — and differ only in what else they require of it.
      const record = (map: MapName, value: string | undefined, qualifies: boolean) => {
        if (value === undefined) return false;
        const { matched } = matchKeys(parent, compile(globsOf(value), true));
        if (matched.length === 0) return false;
        if (!qualifies) return false;
        for (const glob of matched) usedAlternatives.add(label(map, name, glob));
        return true;
      };

      // Every map is consulted, not short-circuited on the first that permits the position: an
      // alternative left unread has still qualified this directory, and the classification below would
      // go on to blame an exclusion elsewhere in its glob for the silence.
      const byPlacement = record('placements', placements[name], true);
      const byCapUnit = record('capitalisedUnitPlacements', capUnits[name], isUnitDir(parent, filesIn));
      const byAnyUnit = record('anyCaseUnitPlacements', anyUnits[name], isAnyCaseUnitDir(parent, filesIn));
      if (byPlacement || byCapUnit || byAnyUnit) continue;

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

    // One finding carrying every declaration that is not checking what it says. `findingKey`
    // (`id::route::location`, packages/cli/src/baseline.ts) leaves both fields unset for every
    // project-scoped result, so N separate findings would collapse to one baseline entry and
    // suppressing one would silently suppress the rest.
    const notes = new Map<string, string>(emptyNames);
    const unusedLabels = [...globalAlternatives.keys()].filter((k) => !usedAlternatives.has(k));
    const globOf = (key: string) => globalAlternatives.get(key)?.glob as string;

    const stillUnused = unusedLabels.filter((k) => !notes.has(k));
    // Everything below is deferred behind this guard: a correct configuration leaves `stillUnused`
    // empty, and then the tree is never walked for exclusions or unit-hood at all. That saving is
    // why the reasons can afford to be whole-tree reach questions.
    if (stillUnused.length > 0) {
      // A declaration is judged by what its glob can reach, not by what it happened to govern — a
      // declaration saying where a name MAY sit is not dead for going unused. `exclude` is taken from
      // the global resolution only, matching the rule's decision to diagnose only globally resolved
      // declarations.
      const globalExcluded = compile(listOption(globalOptions, 'exclude'));
      const liveDirs = allDirs.filter((d) => !isExcluded(d, ancestorDirs(d), globalExcluded));
      // The live directories that are units of each kind — what a unit-map glob must reach to be
      // doing anything, against the same pruned tree the other two reasons use.
      const liveUnits: Record<'capitalisedUnitPlacements' | 'anyCaseUnitPlacements', string[]> = {
        capitalisedUnitPlacements: liveDirs.filter((d) => isUnitDir(d, filesIn)),
        anyCaseUnitPlacements: liveDirs.filter((d) => isAnyCaseUnitDir(d, filesIn))
      };

      const globs = [...new Set(stillUnused.map(globOf))];
      const reachesAny = keysMatchingAny(globs, allDirs, compile);
      const reachesLive = keysMatchingAny(globs, liveDirs, compile);
      for (const k of stillUnused) {
        const glob = globOf(k);
        if (!reachesAny.has(glob)) notes.set(k, 'matched no directory');
        else if (!reachesLive.has(glob)) notes.set(k, 'matched only excluded directories');
      }

      // Ordered after the two above because "the exclusion pruned everything" and "the path does not
      // exist" are the more specific answers, and both are actionable on their own.
      for (const map of ['capitalisedUnitPlacements', 'anyCaseUnitPlacements'] as const) {
        const inMap = stillUnused.filter((k) => !notes.has(k) && globalAlternatives.get(k)?.map === map);
        const inMapGlobs = [...new Set(inMap.map(globOf))];
        const reachesUnit = keysMatchingAny(inMapGlobs, liveUnits[map], compile);
        for (const k of inMap) if (!reachesUnit.has(globOf(k))) notes.set(k, 'reaches no unit');
      }
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
        recommendation: 'Correct the glob or the name, or remove the declaration.',
        docsUrl
      });
    }
    return out;
  }
};
