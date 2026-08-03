import { componentRule } from '../component-rule.js';
import { listOption } from '../../rule-options.js';

const ID = 'architecture/doc-link-target';

/** A `#fragment` or `?query` addresses a location within the target, not the target's own path. */
function stripFragment(url: string): string {
  const i = url.search(/[#?]/);
  return i === -1 ? url : url.slice(0, i);
}

/** `root` without a trailing slash — the path boundary a match must respect regardless of how it was declared. */
function baseOf(root: string): string {
  return root.endsWith('/') ? root.slice(0, -1) : root;
}

/**
 * The project-relative remainder of `url` under `root`, or undefined when `url` doesn't sit under it.
 * Matched at a path-segment boundary (`${base}/`) — not bare `startsWith(root)` — so a root declared
 * without its trailing slash can't match past a partial segment (`.../ui` must not match `.../uiOther`),
 * and a `url` equal to `root` itself (with or without its own trailing slash) yields `''`, not undefined.
 * The remainder is run through `baseOf` too, so a directory link written with its own trailing slash
 * (the ordinary way to address one) is normalised the same way the root already is.
 */
function remainderUnder(url: string, root: string): string | undefined {
  const base = baseOf(root);
  if (url === base) return '';
  return url.startsWith(`${base}/`) ? baseOf(url.slice(base.length + 1)) : undefined;
}

/** Whether `target` sits under `src/` — the only tree `sourceFiles` (a glob rooted at `src/`) can see. */
function isUnderSrc(target: string): boolean {
  return target === 'src' || target.startsWith('src/');
}

/** The declared root this URL sits under, longest first so a nested root cannot be shadowed. */
function rootFor(url: string, roots: string[]): { base: string; remainder: string } | undefined {
  let best: { base: string; remainder: string } | undefined;
  for (const r of roots) {
    const remainder = remainderUnder(url, r);
    if (remainder === undefined) continue;
    const base = baseOf(r);
    if (best === undefined || base.length > best.base.length) best = { base, remainder };
  }
  return best;
}

/** `sourceFiles` lists files, so a directory exists exactly when some entry sits under it. */
function targetExists(path: string, sourceFiles: readonly string[]): boolean {
  const prefix = `${path}/`;
  return sourceFiles.some((f) => f === path || f.startsWith(prefix));
}

/** The declared-prefix links in this component, paired with their project-relative target. */
function references(links: { url: string; line: number }[], roots: string[]): { line: number; target: string }[] {
  const out: { line: number; target: string }[] = [];
  for (const { url, line } of links) {
    const match = rootFor(stripFragment(url), roots);
    // No declared root — not claimed as a reference. This is the precision gate: shape never decides.
    if (match === undefined) continue;
    // Empty remainder = a link to the root itself, which exists by definition — not a claim to check.
    if (match.remainder === '') continue;
    // Outside `src/`, the inventory has no opinion — "absent" would mean "unindexed", not "missing".
    // Same gate as an unmatched URL, one level in: unclaimed, not reported.
    if (!isUnderSrc(match.remainder)) continue;
    out.push({ line, target: match.remainder });
  }
  return out;
}

// `componentRule` sets `location` to the file holding the link (the only file this rule ever sees),
// never the target that moved — unlike the sibling directory rules, there is no better file to point
// at instead. So `filterToChangedFiles` drops this rule's headline case (a rename breaking a link
// elsewhere) from every `--diff` run unless the referencing file happened to change too. Recorded in
// the rule docs' "Limitations", not fixed here — no `location` choice closes it.
export const architectureDocLinkTarget = componentRule({
  id: ID,
  title: 'Documentation link target',
  category: 'architecture',
  severity: 'info',
  label: 'Documentation link targets',
  options: { urlRoots: { kind: 'string-list', default: [] } },
  recommendation:
    'Point the link at the unit that exists now, or remove it. A link inside a comment has nothing to resolve it, so a rename leaves it silently broken.',
  rationale:
    'A documentation link written in a comment is invisible to type checking, module resolution and the test runner, so a convention-driven rename leaves it pointing at nothing and only human review notices.',
  applies: (c, o, ctx) =>
    ctx.sourceFiles !== undefined && references(c.commentLinks ?? [], listOption(o, 'urlRoots')).length > 0,
  bad: (c, o, ctx) =>
    references(c.commentLinks ?? [], listOption(o, 'urlRoots'))
      .filter(({ target }) => !targetExists(target, ctx.sourceFiles ?? []))
      .map(({ line, target }) => ({ line, message: `${target} does not exist` }))
});
