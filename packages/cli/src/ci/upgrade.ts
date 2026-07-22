import { actionPinComment, ACTION_PIN_COMMENT_RE } from './action-pin-comment.js';

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

// Matches lines like (indentation, an optional YAML anchor `&name`, and the trailing
// version comment, are all optional so a user's hand-edited workflow still matches):
//   - uses: oekazuma/svelte-vitals/packages/action@<ref>
//   - uses: oekazuma/svelte-vitals/packages/action@<ref> # action-v1.2.3
//   - uses: &vitals_action oekazuma/svelte-vitals/packages/action@<ref> # action-v1.2.3
// The comment also still matches the pre-fix `# @svelte-vitals/action@1.2.3` format (see
// action-pin-comment.ts) so a workflow installed before that fix still upgrades cleanly.
// An anchor definition's value is shared by every `*name` alias line elsewhere in the
// file (YAML semantics) — rewriting only the anchor line's ref is sufficient; alias
// lines need no separate rewrite.
const ACTION_USES_LINE =
  /^(?<indent>\s*-\s*uses:\s*(?:&\S+\s+)?oekazuma\/svelte-vitals\/packages\/action@)(?<ref>[^\s#]+)(?<comment>\s*#.*)?$/;

// The pre-fix npm-scoped comment (`# @svelte-vitals/action@X.Y.Z`) isn't parseable by
// Renovate's github-actions manager — a line already pinned to the current sha but still
// carrying this comment shape needs its comment normalized, not just a sha check.
const LEGACY_COMMENT = /#\s*@svelte-vitals\/action@/;

/**
 * Rewrite every `uses: oekazuma/svelte-vitals/packages/action@<ref>` line in `content` to pin
 * `sha`, with a same-line `# action-v<version>` comment — leaving every other line (including
 * other `uses:` pins, like `actions/checkout`) untouched.
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

    const { indent, ref } = match.groups;
    if (indent === undefined || ref === undefined) return line;
    const comment = match.groups.comment ?? '';
    if (ref === sha && !LEGACY_COMMENT.test(comment)) return line; // already pinned and comment is already canonical

    if (from === undefined) {
      const commentMatch = ACTION_PIN_COMMENT_RE.exec(comment);
      from = commentMatch ? commentMatch[1] : ref.slice(0, 7);
    }

    replaced += 1;
    return `${indent}${sha} # ${actionPinComment(version)}${eol}`;
  });

  if (replaced === 0) {
    const hasAnyReference = lines.some((line) => ACTION_USES_LINE.test(line.endsWith('\r') ? line.slice(0, -1) : line));
    return { status: hasAnyReference ? 'up-to-date' : 'no-reference' };
  }

  return { status: 'upgraded', content: next.join('\n'), replaced, from };
}
