import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { BasePathLinkFact, SuppressionDirective } from '../../component.js';
import { isSuppressed } from '../component-rule.js';
import { PENALIZED, PASS } from '../detection.js';

const ID = 'correctness/base-path-navigation';
const DOCS_URL = docsUrlFor(ID);
const LABEL = 'Base-path-aware navigation';
const RECOMMENDATION =
  "Wrap root-relative paths in resolve() from '$app/paths' so they resolve against kit.paths.base.";
const FIX = {
  description:
    "Import { resolve } from '$app/paths' and wrap the path: href={resolve('/about')}, goto(resolve('/about')), redirect(303, resolve('/login'))."
};

function messageFor(link: BasePathLinkFact): string {
  if (link.kind === 'href') {
    return `<a href="${link.path}"> is root-relative — under this project's kit.paths.base it points at the domain root, outside the app, and 404s in production. Use resolve('${link.path}') from '$app/paths'.`;
  }
  if (link.kind === 'goto') {
    return `goto('${link.path}') is root-relative — it navigates outside this project's kit.paths.base and 404s in production. Use goto(resolve('${link.path}')) with resolve from '$app/paths'.`;
  }
  return `redirect(…, '${link.path}') is root-relative — the Location header points outside this project's kit.paths.base and 404s in production. Use resolve('${link.path}') from '$app/paths'.`;
}

/**
 * A literal that already carries a statically known base is correct as written; only a dynamic
 * base (no `value`) leaves every root-relative literal suspect.
 */
function startsWithBase(path: string, base: string | undefined): boolean {
  if (base === undefined || !path.startsWith(base)) return false;
  const next = path.charAt(base.length);
  return next === '' || next === '/' || next === '?' || next === '#';
}

/** Emit one file's PASS/PENALIZED results — same shapes as componentRule/kitModuleRule. */
function emitFile(
  out: Result[],
  file: string,
  links: BasePathLinkFact[],
  suppressions: SuppressionDirective[] | undefined,
  base: string | undefined
): void {
  const bad = links.filter(
    (l) => !startsWithBase(l.path, base) && !(l.line > 0 && isSuppressed(suppressions, ID, l.line))
  );
  if (bad.length === 0) {
    out.push({
      id: ID,
      category: 'correctness',
      severity: 'warning',
      detection: PASS,
      route: file,
      // Uniform PASS-result attribution (design 2026-08-08-pass-result-location-design.md):
      // same location a penalized result for this file would carry.
      location: file,
      message: LABEL,
      recommendation: RECOMMENDATION,
      docsUrl: DOCS_URL
    });
    return;
  }
  for (const l of bad) {
    out.push({
      id: ID,
      category: 'correctness',
      severity: 'warning',
      detection: PENALIZED,
      route: file,
      location: file,
      ...(l.line > 0 ? { line: l.line } : {}),
      message: messageFor(l),
      recommendation: RECOMMENDATION,
      docsUrl: DOCS_URL,
      fix: { ...FIX }
    });
  }
}

/**
 * correctness/base-path-navigation — root-relative navigation literals in a project that sets
 * `kit.paths.base`. A custom check because it is gated on a PROJECT fact and its own facts live
 * on BOTH the component channel (`<a href>`, `goto()`) and the Kit-module channel (`redirect()`).
 * With no base path configured the rule emits nothing at all — the gate is the whole point.
 */
export const correctnessBasePathNavigation: Rule = {
  id: ID,
  title: 'Root-relative navigation under a base path',
  category: 'correctness',
  severity: 'warning',
  scope: 'component',
  rationale:
    'A root-relative literal resolves against the domain root, not kit.paths.base, so navigation lands outside an app served from a sub-path. The break only appears once the app is deployed under its base — locally base is usually empty, so every such link works.',
  fix: { ...FIX },
  async check(ctx: RuleContext): Promise<Result[]> {
    if (!ctx.project.kitPathsBase) return [];
    const base = ctx.project.kitPathsBase.value;
    const out: Result[] = [];
    for (const c of ctx.components ?? []) {
      const links = c.basePathLinks ?? [];
      if (links.length === 0) continue;
      emitFile(out, c.file, links, c.suppressions, base);
    }
    for (const m of ctx.kitModules ?? []) {
      const links = m.basePathLinks ?? [];
      if (links.length === 0) continue;
      emitFile(out, m.file, links, m.suppressions, base);
    }
    return out;
  }
};
