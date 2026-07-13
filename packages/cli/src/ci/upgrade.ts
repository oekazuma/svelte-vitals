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

// Matches lines like (indentation, and the trailing version comment, are both optional so a
// user's hand-edited workflow still matches):
//   - uses: oekazuma/svelte-vitals/packages/action@<ref>
//   - uses: oekazuma/svelte-vitals/packages/action@<ref> # @svelte-vitals/action@1.2.3
const ACTION_USES_LINE =
  /^(?<indent>\s*-\s*uses:\s*oekazuma\/svelte-vitals\/packages\/action@)(?<ref>[^\s#]+)(?<comment>\s*#.*)?$/;

/**
 * Rewrite every `uses: oekazuma/svelte-vitals/packages/action@<ref>` line in `content` to pin
 * `sha`, with a same-line `# @svelte-vitals/action@<version>` comment — leaving every other line
 * (including other `uses:` pins, like `actions/checkout`) untouched.
 */
export function upgradeActionPin(content: string, sha: string, version: string): UpgradeOutcome {
  const lines = content.split('\n');
  let replaced = 0;
  let from: string | undefined;

  const next = lines.map((line) => {
    const match = ACTION_USES_LINE.exec(line);
    if (!match || !match.groups) return line;

    const { indent, ref } = match.groups;
    if (indent === undefined || ref === undefined) return line;
    if (ref === sha) return line; // already pinned to the current sha

    if (from === undefined) {
      const commentMatch = /#\s*@svelte-vitals\/action@(\S+)/.exec(match.groups.comment ?? '');
      from = commentMatch ? commentMatch[1] : ref.slice(0, 7);
    }

    replaced += 1;
    return `${indent}${sha} # @svelte-vitals/action@${version}`;
  });

  if (replaced === 0) {
    const hasAnyReference = lines.some((line) => ACTION_USES_LINE.test(line));
    return { status: hasAnyReference ? 'up-to-date' : 'no-reference' };
  }

  return { status: 'upgraded', content: next.join('\n'), replaced, from };
}
