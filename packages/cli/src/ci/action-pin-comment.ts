/**
 * The same-line version comment appended to the action's SHA-pinned `uses:` line, e.g.
 * `# action-v0.3.5`. Must stay in a format Renovate's github-actions manager can parse as a
 * version (`<prefix><-|/>v?<semver>`) — an npm-style `@svelte-vitals/action@0.3.5` comment
 * (the pre-fix format) doesn't match Renovate's regex, so it could never see or bump the pin.
 */
export function actionPinComment(version: string): string {
  return `action-v${version}`;
}

/** Matches either the current comment format or the pre-fix npm-style one, capturing the version. */
export const ACTION_PIN_COMMENT_RE = /#\s*(?:action-v|@svelte-vitals\/action@)(\S+)/;
