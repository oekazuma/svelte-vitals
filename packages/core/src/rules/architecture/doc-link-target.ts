import { componentRule } from '../component-rule.js';
import { listOption } from '../../rule-options.js';

const ID = 'architecture/doc-link-target';

/** The declared prefix this URL sits under, longest first so a nested root cannot be shadowed. */
function rootFor(url: string, roots: string[]): string | undefined {
  let best: string | undefined;
  for (const r of roots) {
    if (url.startsWith(r) && (best === undefined || r.length > best.length)) best = r;
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
    const root = rootFor(url, roots);
    // No declared root — not claimed as a reference. This is the precision gate: shape never decides.
    if (root === undefined) continue;
    out.push({ line, target: url.slice(root.length) });
  }
  return out;
}

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
