import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import { listOption, mapOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
import {
  ancestorDirs,
  baseName,
  classifyUnusedKeys,
  createKeyCompiler,
  isExcluded,
  matchKeys,
  reportAt
} from './declarations.js';
import { decodeSegment, parseCasings, satisfiesCasing } from './casing.js';

const docsUrl = docsUrlFor('architecture/directory-naming');
const recommendation = 'Name each directory in the casing its location declares, or narrow the declaration.';

// Inert by default: with nothing declared there is no convention to check, and svelte-vitals never
// guesses what a project's directory names are supposed to mean.
const OPTIONS: RuleOptionsSpec = {
  directories: { kind: 'string-map', default: {} },
  exclude: { kind: 'string-list', default: [] }
};

/**
 * architecture/directory-naming — a directory must be named in the casing its location declares
 * (design 2026-07-29). L3: the declarations come from the project's own `directories` and `exclude`
 * options and are never inferred, so the rule is inert until then.
 *
 * Violations report at a file inside the directory rather than at the directory, because
 * `filterToChangedFiles` keeps only locations git lists as changed and git never lists a directory.
 *
 * There are no pass results. `architecture/unit-entry-file` emits one per conforming unit and can
 * afford to, because it keys the pass on the unit's entry file — a `.svelte` path already present as
 * a score key. This rule's subject is the directory itself, with no such pre-existing key, and
 * `computeScore` seeds every distinct `route` at 100 and averages: a pass per directory would add
 * hundreds of 100s from one `'src/routes/**'` declaration and dilute every real finding.
 */
export const architectureDirectoryNaming: Rule = {
  id: 'architecture/directory-naming',
  title: 'Directory naming',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    'A directory whose name breaks the convention its location declares stops carrying the meaning the convention gave it, and every reader — human or agent — has to open the directory to learn what it is.',
  fix: {
    description: 'Rename the directory to the declared casing, or narrow the declaration that governs it.'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const files = ctx.sourceFiles;
    if (files === undefined) return [];

    const compiledOverrides = compileOverrides(ctx.config);
    const dirs = new Set<string>();
    for (const f of files) for (const d of ancestorDirs(f)) dirs.add(d);

    const compile = createKeyCompiler();
    // Values are parsed once per distinct string, not once per directory.
    const parsed = new Map<string, { known: string[]; unknown: string[] }>();
    const casingsOf = (value: string) => {
      let p = parsed.get(value);
      if (p === undefined) parsed.set(value, (p = parseCasings(value)));
      return p;
    };

    const out: Result[] = [];
    const globalOptions = resolveRuleOptions('architecture/directory-naming', OPTIONS, ctx.config);
    const globalMap = mapOption(globalOptions, 'directories');
    const globalKeys = new Set(Object.keys(globalMap));
    const usedKeys = new Set<string>();
    // Collected only so an unmatched key can be told from a shadowed one at the end. Never
    // consulted unless some key finishes the run with no work recorded.
    const excludedDirs: string[] = [];

    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(
        'architecture/directory-naming',
        OPTIONS,
        ctx.config,
        { route: dir, file: dir },
        compiledOverrides
      );
      const declared = mapOption(o, 'directories');
      if (Object.keys(declared).length === 0) continue; // inert

      // Exclusion first: an excluded directory is one this rule is forbidden to look at, so a key
      // whose every match lands here has evaluated nothing and must not be recorded as work.
      const excluded = compile(listOption(o, 'exclude'));
      if (isExcluded(dir, ancestorDirs(dir), excluded)) {
        excludedDirs.push(dir);
        continue;
      }

      // A key naming no known casing at all is dropped before matching, so it never governs a
      // directory and never wins a tie-break. Left in, a typo would win on specificity, have no
      // casing to apply, and take the whole subtree out of the check — a dead key silently
      // cancelling a live one.
      const live = Object.keys(declared).filter((k) => casingsOf(declared[k] as string).known.length > 0);
      const m = matchKeys(dir, compile(live, true));
      // Recorded for every surviving match, before the two skips below and whether or not the key
      // won the tie-break: in both cases the key identified the directory and a check ran.
      for (const k of m.matched) if (globalKeys.has(k)) usedKeys.add(k);
      if (m.best === undefined) continue;

      const decoded = decodeSegment(baseName(dir));
      if (decoded === undefined) continue; // a compound route segment names no single identifier
      const allowed = casingsOf(declared[m.best] as string).known;
      if (satisfiesCasing(decoded, allowed)) continue;

      const at = reportAt(dir, files);
      if (at === undefined) continue; // unreachable: the directory came from a file's prefix
      out.push({
        id: 'architecture/directory-naming',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        route: at,
        location: at,
        message: `${dir} must be ${allowed.join(' or ')}.`,
        recommendation,
        docsUrl,
        fix: { description: 'Rename the directory, or narrow the declaration that governs it.' }
      });
    }

    // One finding carrying every declaration that is not checking what it says. `findingKey`
    // (`id::route::location`, packages/cli/src/baseline.ts) leaves both fields unset for every
    // project-scoped result, so N separate findings would collapse to one baseline entry and
    // suppressing one would silently suppress the rest.
    //
    // The vocabulary reason is decided FIRST. A key naming no known casing was dropped before
    // matching and so has no recorded work by construction; feeding it to the excluded-directory
    // classification would label a value typo "matched no directory", or worse, "matched only
    // excluded directories".
    const notes = new Map<string, string>();
    for (const key of globalKeys) {
      const { known, unknown } = casingsOf(globalMap[key] as string);
      if (unknown.length === 0) continue;
      const names = unknown.map((u) => `'${u}'`).join(', ');
      notes.set(
        key,
        known.length === 0
          ? `unknown casing name ${names}, so it checks nothing`
          : `unknown casing name ${names}; the rest of the value still applies`
      );
    }
    const unclassified = [...globalKeys].filter(
      (key) => !notes.has(key) && !usedKeys.has(key) && casingsOf(globalMap[key] as string).known.length > 0
    );
    const reasons = classifyUnusedKeys(unclassified, excludedDirs, compile);
    for (const [key, reason] of reasons) {
      notes.set(key, reason === 'only-excluded' ? 'matched only excluded directories' : 'matched no directory');
    }

    const reported = [...notes.keys()].sort();
    if (reported.length > 0) {
      const message =
        reported.length === 1
          ? `The declaration '${reported[0]}' does not check what it says: ${notes.get(reported[0] as string)}.`
          : `These declarations do not check what they say: ${reported.map((k) => `'${k}' (${notes.get(k)})`).join(', ')}.`;
      out.push({
        id: 'architecture/directory-naming',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message,
        recommendation: 'Correct the glob or the casing name, or remove the declaration.',
        docsUrl
      });
    }
    return out;
  }
};
