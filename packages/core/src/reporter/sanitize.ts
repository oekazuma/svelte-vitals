/**
 * Escapers for strings that originate from the analyzed project (file paths, route ids,
 * rule messages that quote page content such as `<title>` or JSON-LD values) rather than
 * from svelte-vitals itself. A hostile — or merely unlucky — analyzed repo controls those
 * strings, so reporters must neutralize them at the point they're interpolated into a
 * rendered report, without touching svelte-vitals' own template text around them.
 */

/** Wrap `text` in inline code, using enough backticks to survive any backtick run inside it. */
function inlineCode(text: string): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/**
 * Escape a string for a Markdown-rendered report (agent/markdown reporters). Neutralizes
 * the constructs that let injected content stop being "quoted data" and start being
 * structure: embedded newlines (which can open a new heading/table row/fence on the next
 * line), `[text](url)` links (which render as clickable), and bare `<tag>` HTML — wrapped
 * in inline code, which is also how svelte-vitals renders its own `<head>` tag mentions,
 * so a real `<title>`/`<meta>` reference stays readable instead of being stripped by the
 * renderer as unrecognized HTML.
 */
export function mdEscape(text: string): string {
  return (
    text
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/<[^>]+>/g, (tag) => inlineCode(tag))
      // ponytail: `[^)]*` stops at the first `)`, so a URL with its own unescaped
      // parens (rare outside contrived payloads) leaves one stray `)` after the escaped
      // pair instead of round-tripping cleanly. Still inert either way — `\(` is a literal
      // paren, not link-opening syntax — so this only affects cosmetics, not safety.
      .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '[$1]\\($2\\)')
  );
}

/**
 * Strip ANSI/OSC escape sequences and C0 control characters (except `\n`/`\t`) from a
 * string before it reaches a terminal. POSIX file/route names can contain almost any
 * byte, so a hostile repo can smuggle a terminal-title rewrite, cursor move, or other
 * escape-sequence trick into what looks like plain report text.
 *
 * Only OSC and CSI sequences are pattern-matched and removed whole (payload included) —
 * those cover title-bar writes and cursor/screen control, the two classes with a real
 * blast radius. Any other `ESC` byte (rarer single/two-byte forms like reset or
 * save-cursor) falls through to the final C0 sweep below, which drops the lone `ESC`
 * but — deliberately, not swallowing an adjacent legitimate character — leaves whatever
 * printable byte follows it as stray text.
 * ponytail: doesn't special-case every Fe escape form; broaden the CSI/OSC patterns if a
 * concrete non-CSI/OSC sequence turns out to matter.
 */
/* oxlint-disable no-control-regex -- deliberately matching C0/DEL/ESC control bytes to strip them */
export function terminalSafe(text: string): string {
  return text
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, '') // OSC ... (BEL | ST)
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '') // CSI ... final byte
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}
/* oxlint-enable no-control-regex */
