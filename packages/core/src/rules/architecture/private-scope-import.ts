import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides, routeGlobToRegExp } from '../../config-apply.js';
import { resolveRepoLocalPath } from '../../kit-module-parse.js';
import { listOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
import { isSuppressed } from '../component-rule.js';

const docsUrl = docsUrlFor('architecture/private-scope-import');
const recommendation =
  'Move the unit to the directory shared by all of its importers, or import it only from inside its own scope.';

// Inert by default: with no declared scope there is no convention to check, and
// svelte-vitals never guesses which directories a project treats as private.
const OPTIONS: RuleOptionsSpec = { scopes: { kind: 'string-list', default: [] } };

/** Every ancestor directory of `file`, deepest first (`a/b/c.svelte` → ['a/b', 'a']). */
function ancestorDirs(file: string): string[] {
  const segments = file.split('/');
  const out: string[] = [];
  for (let i = segments.length - 1; i > 0; i--) out.push(segments.slice(0, i).join('/'));
  return out;
}

/**
 * The boundary of the private scope containing `target` — the marker directory's parent
 * (`''` when the marker is a top-level segment, i.e. the repo root) — or undefined when none
 * of `patterns` matches an ancestor. The DEEPEST match wins so nested scopes stay private to
 * their immediate owner rather than only to the outermost one.
 */
function privateScopeOf(target: string, patterns: RegExp[]): string | undefined {
  for (const dir of ancestorDirs(target)) {
    if (!patterns.some((p) => p.test(dir))) continue;
    const cut = dir.lastIndexOf('/');
    return cut === -1 ? '' : dir.slice(0, cut);
  }
  return undefined;
}

/** Whether `file` lives inside `boundary` (an empty boundary is the repo root — always inside). */
function isInside(file: string, boundary: string): boolean {
  return boundary === '' || file.startsWith(`${boundary}/`);
}

/**
 * architecture/private-scope-import — a unit inside a declared private scope must not be
 * imported from outside that scope (design 2026-07-28). L3: the scopes are declared by the
 * project via the `scopes` option and never inferred, so the rule is inert until then.
 *
 * Findings are reported at the import site, not at the imported unit: `--diff` filters
 * results to the files that changed, and the author of the violation edited the importer.
 */
export const architecturePrivateScopeImport: Rule = {
  id: 'architecture/private-scope-import',
  title: 'Private-scope import',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    'A unit placed inside a private directory is written for one owner; importing it from elsewhere couples two parts of the tree that were meant to move independently, and the unit belongs higher up instead.',
  fix: {
    description:
      'Move this unit out of its private scope, to the directory shared by all of its importers, and update this import.'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    // Hoisted: compiling every override's globs once, not once per component.
    const compiled = compileOverrides(ctx.config);
    // An `overrides` entry can declare different scopes for different paths, so options
    // resolve per component — but the compiled patterns are memoised on the resolved list,
    // since a project has a handful of distinct lists and thousands of files.
    const patternCache = new Map<string, RegExp[]>();
    const compileScopes = (scopes: string[]): RegExp[] => {
      const key = JSON.stringify(scopes);
      let patterns = patternCache.get(key);
      if (patterns === undefined) {
        patterns = scopes.map((scope) => {
          // A trailing `/**` matches files INSIDE the marker too (it compiles to `(/.*)?`),
          // so the marker's own subdirectories would match the glob and `privateScopeOf`'s
          // deepest-match rule would pick a descendant as the boundary — a false positive
          // against the owner itself (e.g. `**/parts/**` flagging `parts/Badge/Badge.svelte`
          // importing a sibling under `parts/`). Stripping it makes `'**/parts/**'` compile
          // identically to `'**/parts'`, matching how every other `scopes` glob in this
          // project's own config is written (design 2026-07-28, precision gate).
          const marker = scope.endsWith('/**') ? scope.slice(0, -3) : scope;
          return routeGlobToRegExp(marker);
        });
        patternCache.set(key, patterns);
      }
      return patterns;
    };
    for (const c of ctx.components ?? []) {
      const o = resolveRuleOptions(
        'architecture/private-scope-import',
        OPTIONS,
        ctx.config,
        { route: c.file, file: c.file },
        compiled
      );
      const scopes = listOption(o, 'scopes');
      if (scopes.length === 0) continue; // nothing declared for this file → inert
      const patterns = compileScopes(scopes);
      const spans = c.importSpans ?? c.imports.map((source) => ({ source, line: 0 }));
      let sawScopedImport = false;
      const violations: { line: number; message: string }[] = [];
      for (const { source, line } of spans) {
        const target = resolveRepoLocalPath(source, c.file);
        if (target === undefined) continue; // bare package, unknown alias, or escapes the root
        const boundary = privateScopeOf(target, patterns);
        if (boundary === undefined) continue; // not in a private scope
        sawScopedImport = true;
        if (isInside(c.file, boundary)) continue;
        // `boundary` is never '' here: an empty boundary is the repo root, and `isInside`
        // already accepted every importer above.
        violations.push({ line, message: `${target} is private to ${boundary}` });
      }
      if (!sawScopedImport) continue; // no signal in this file → neither penalize nor seed
      // Suppressed BEFORE deciding pass-vs-penalize: a file whose only violation is
      // suppressed must emit the passing result below, not nothing (componentRule's
      // isSuppressed reused rather than a second copy of the matching logic).
      const visible = violations.filter(
        (v) => !(v.line > 0 && isSuppressed(c, 'architecture/private-scope-import', v.line))
      );
      if (visible.length === 0) {
        out.push({
          id: 'architecture/private-scope-import',
          category: 'architecture',
          severity: 'info',
          detection: { presence: 'own', value: 'static' },
          route: c.file,
          message: 'No private-scope imports',
          recommendation,
          docsUrl
        });
        continue;
      }
      for (const v of visible) {
        out.push({
          id: 'architecture/private-scope-import',
          category: 'architecture',
          severity: 'info',
          detection: { presence: 'none', value: 'absent' },
          route: c.file,
          location: c.file,
          ...(v.line > 0 ? { line: v.line } : {}),
          message: v.message,
          recommendation,
          docsUrl,
          fix: { ...(architecturePrivateScopeImport.fix as NonNullable<Rule['fix']>) }
        });
      }
    }
    return out;
  }
};
