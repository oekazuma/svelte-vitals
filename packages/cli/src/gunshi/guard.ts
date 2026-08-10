/**
 * Raw-argv pre-scan that every gunshi-dispatched command runs before handing argv to gunshi's
 * own parser (Phase 1 spike gate (b), `docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md`).
 * Two gaps gunshi's parser (args-tokens) has no post-parse fix for:
 *
 * - An empty value (`--flag=` / `--flag ''`) on a value-carrying flag is silently dropped from
 *   `values` rather than surfaced as an error — there is no value left to inspect once gunshi has
 *   parsed, so the check has to run on the raw tokens first.
 * - Any explicit value on a declared boolean — including the literal string `'false'` — resolves
 *   to `true`. `parseCliArgs` (cli-args.ts) special-cases `--flag=false` to mean off; reproducing
 *   that means rewriting the token away before gunshi ever sees it.
 *
 * One function, parameterized by the flag lists the caller declares (never a second hardcoded
 * copy of a flag list that already exists elsewhere — `valueFlags` for the root analyzer is
 * `VALUE_FLAGS` from `resolve-args.ts`; `docs`/`explain` pass `[]`, since neither declares a
 * value-carrying flag today).
 */

export interface GuardResult {
  /** Fatal `--<flag> requires a value.` messages; empty when nothing was rejected. */
  errors: string[];
  /** `argv` with every `--<boolFlag>=false` token removed (equivalent to the flag never being passed). */
  argv: string[];
}

/** A value token is bad if it's missing, empty, or dash-leading — `--out-file`'s literal `-` (stdout) is the one exception. */
function isBadValue(flag: string, value: string | undefined): boolean {
  return value === undefined || value === '' || (value.startsWith('-') && !(flag === 'out-file' && value === '-'));
}

export function guardArgs(argv: string[], valueFlags: readonly string[], booleanFlags: readonly string[]): GuardResult {
  const errors: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    for (const flag of valueFlags) {
      const eq = `--${flag}=`;
      if (token === `--${flag}`) {
        if (isBadValue(flag, argv[i + 1])) errors.push(`svelte-vitals: --${flag} requires a value.`);
      } else if (token.startsWith(eq)) {
        if (isBadValue(flag, token.slice(eq.length))) errors.push(`svelte-vitals: --${flag} requires a value.`);
      }
    }
  }

  // Duplicate boolean tokens are last-wins under the legacy parser (`util.parseArgs` overwrites
  // on repetition, then cli-args.ts coerces a final literal 'false' to off) — so when a flag's
  // LAST occurrence is `=false`, every token of that flag must go, not just the `=false` ones.
  const offFlags = new Set(
    booleanFlags.filter((flag) => {
      let lastToken: string | undefined;
      for (const t of argv) if (t === `--${flag}` || t === `--${flag}=false`) lastToken = t;
      return lastToken === `--${flag}=false`;
    })
  );
  const argvNormalized = argv.filter((token) => {
    for (const flag of booleanFlags) {
      if (token === `--${flag}=false` || (offFlags.has(flag) && token === `--${flag}`)) return false;
    }
    return true;
  });

  return { errors, argv: argvNormalized };
}
