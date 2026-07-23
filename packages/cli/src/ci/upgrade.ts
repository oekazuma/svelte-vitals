export interface UpgradeOutcome {
  status: 'upgraded' | 'up-to-date' | 'no-reference';
  /** status='upgraded' only: the full file content with the pin(s) replaced. */
  content?: string;
  /** status='upgraded' only: how many `uses:` lines were rewritten. */
  replaced?: number;
  /** status='upgraded' only: the previous version (from the line's comment) or, absent a
   *  comment, the previous SHA's first 7 characters. */
  from?: string;
}

const CANONICAL_PATH = 'oekazuma/svelte-vitals-action';

// Matches lines like (indentation, an optional YAML anchor `&name`, and the trailing
// version comment, are all optional so a user's hand-edited workflow still matches):
//   - uses: oekazuma/svelte-vitals-action@<ref>
//   - uses: oekazuma/svelte-vitals-action@<ref> # v1.2.3
//   - uses: &vitals_action oekazuma/svelte-vitals-action@<ref> # v1.2.3
// `repoPath` also matches the pre-migration path (`oekazuma/svelte-vitals/packages/action`) so
// a workflow installed before the action moved to its own repository still upgrades cleanly —
// captured separately from `indent` so a rewrite always emits the canonical path, not whatever
// variant matched. An anchor definition's value is shared by every `*name` alias line elsewhere
// in the file (YAML semantics) — rewriting only the anchor line's ref is sufficient; alias
// lines need no separate rewrite.
const ACTION_USES_LINE =
  /^(?<indent>\s*-\s*uses:\s*(?:&\S+\s+)?)(?<repoPath>oekazuma\/svelte-vitals(?:-action|\/packages\/action))@(?<ref>[^\s#]+)(?<comment>\s*#.*)?$/;

// Matches a version out of the trailing comment: the current plain `v1.2.3` form, or either
// of the pre-migration monorepo forms (`action-v1.2.3`, the older `@svelte-vitals/action@1.2.3`).
const PIN_COMMENT_RE = /#\s*(?:v|action-v|@svelte-vitals\/action@)(\S+)/;

/**
 * A comment is canonical only if it's exactly `# v<version>` for THIS target version — a line
 * already pinned to the current sha but carrying a pre-migration shape (`action-v...`,
 * `@svelte-vitals/action@...`) or a stale/mismatched version number both need rewriting, not
 * just a sha check.
 */
function isCanonicalComment(comment: string, version: string): boolean {
  return comment.trim() === `# v${version}`;
}

/**
 * Rewrite every `uses: oekazuma/svelte-vitals-action@<ref>` line (or the pre-migration
 * `oekazuma/svelte-vitals/packages/action@<ref>` form) in `content` to pin `sha`, with a
 * same-line `# v<version>` comment — leaving every other line (including other `uses:`
 * pins, like `actions/checkout`) untouched.
 */
export function upgradeActionPin(content: string, sha: string, version: string): UpgradeOutcome {
  const lines = content.split('\n');
  let replaced = 0;
  let from: string | undefined;

  const next = lines.map((line) => {
    // Splitting a CRLF file on '\n' leaves a trailing '\r' on every line — strip it before
    // matching (the regex is anchored with `$`) and re-append it to a rewritten line so the
    // file's line endings are preserved.
    const eol = line.endsWith('\r') ? '\r' : '';
    const bare = eol ? line.slice(0, -1) : line;
    const match = ACTION_USES_LINE.exec(bare);
    if (!match || !match.groups) return line;

    const { indent, repoPath, ref } = match.groups;
    if (indent === undefined || repoPath === undefined || ref === undefined) return line;
    const comment = match.groups.comment ?? '';
    const commentMatch = PIN_COMMENT_RE.exec(comment);
    // Already fully up to date only if the sha, comment (matching THIS version, not just
    // shaped like one), AND path (not still the pre-migration monorepo path) are all
    // already canonical.
    if (ref === sha && isCanonicalComment(comment, version) && repoPath === CANONICAL_PATH) return line;

    if (from === undefined) {
      from = commentMatch ? commentMatch[1] : ref.slice(0, 7);
    }

    replaced += 1;
    return `${indent}${CANONICAL_PATH}@${sha} # v${version}${eol}`;
  });

  if (replaced === 0) {
    const hasAnyReference = lines.some((line) => ACTION_USES_LINE.test(line.endsWith('\r') ? line.slice(0, -1) : line));
    return { status: hasAnyReference ? 'up-to-date' : 'no-reference' };
  }

  return { status: 'upgraded', content: next.join('\n'), replaced, from };
}
