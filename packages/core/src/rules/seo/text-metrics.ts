// Pure text measurement for SEO length rules. No node:, no deps.

/** Visible character count as a SERP would show it: trimmed, internal whitespace runs collapsed, counted by code point. */
export function visibleLength(s: string): number {
  const collapsed = s.trim().replace(/\s+/g, ' ');
  return [...collapsed].length;
}
