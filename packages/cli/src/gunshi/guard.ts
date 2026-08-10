/**
 * Raw-argv pre-scan that every gunshi-dispatched command runs before handing argv to gunshi's
 * own parser (Phase 1 spike gate (b), `docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md`).
 * Two gaps gunshi's parser (args-tokens) has no post-parse fix for:
 *
 * - An empty value (`--flag=` / `--flag ''`) on a value-carrying flag is silently dropped from
 *   `values` rather than surfaced as an error — there is no value left to inspect once gunshi has
 *   parsed, so the check has to run on the raw tokens first.
 * - Any explicit value on a declared boolean — including the literal string `'false'` — resolves
 *   to `true`. `--flag=false` is meant to turn a boolean off (the pre-gunshi parsing convention);
 *   reproducing that means rewriting the token away before gunshi ever sees it.
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

  // Duplicate boolean tokens are last-wins under `node:util`'s parseArgs (overwrites on
  // repetition, then a final literal 'false' coerces to off) — so when a flag's LAST occurrence
  // is `=false`, every token of that flag must go, not just the `=false` ones.
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

/**
 * Splits argv at the first literal `--` token — the shell's own "stop parsing flags" convention,
 * honored natively by `node:util`'s `parseArgs` (what every legacy runner in this CLI is built
 * on). `head` is everything before it, still subject to every pre-parse layer (guard, strip,
 * gunshi itself). `tail` is everything after it (the `--` itself dropped) and must never be
 * treated as a flag again by anything — the caller appends it verbatim to whatever positional
 * channel it tracks. Absent, `head` is the whole argv and `tail` is empty.
 *
 * Every gunshi-dispatched command splits BEFORE calling `guardArgs`/`stripUnknownFlags`: neither
 * of those understands `--`, so left unsplit they mistake a post-`--` token that merely looks like
 * a flag (`<path> -- --score`) for a real one — `stripUnknownFlags` even drops the bare `--` token
 * itself (an unknown "long flag" named `''`), which is what let gunshi's own parser see the
 * unescaped tokens afterward and reinterpret them.
 */
export function splitAtTerminator(argv: string[]): { head: string[]; tail: string[] } {
  const i = argv.indexOf('--');
  return i === -1 ? { head: argv, tail: [] } : { head: argv.slice(0, i), tail: argv.slice(i + 1) };
}

/**
 * gunshi's parser (args-tokens) treats any UNDECLARED long/short option as string-like: a
 * positional immediately following it gets consumed as that option's own value instead of
 * staying a positional (confirmed empirically — `node:util`'s `parseArgs(strict:false)`, which
 * every legacy runner in this CLI uses, treats the same shape as boolean and leaves the
 * positional alone). Left unhandled, a typo'd flag right before a declared positional (an
 * analyzed path, `docs show <name>`, `explain <rule-id>`) would silently swallow it instead of
 * just being ignored — breaking the "unknown flags are silently ignored" contract for that one
 * argv shape. Stripped here, before gunshi ever parses: the token is dropped, its follower is
 * never touched, so the follower surfaces as a positional exactly as the legacy parser would
 * leave it.
 *
 * A grouped short like `-hx` mixes a known flag with an unknown one — node's parseArgs
 * (strict:false) expands the group and keeps the known members, dropping only the unrecognized
 * ones; reproduced here by filtering characters instead of testing the whole token. A single
 * unknown short (`-x`) is the same case with zero survivors. `-5`/`-digit` gets no special
 * exemption: node never treats it as a positional-preserving case either (an undeclared short is
 * an undeclared short), so it drops like any other unknown short.
 *
 * `knownLong`/`knownShort` are the flag names this specific command recognizes ACROSS ITS WHOLE
 * FAMILY (every sub-command's own flags, for a command with sub-commands) — not just the ones the
 * particular sub-command handling a given invocation happens to read. Pre-gunshi, every command's
 * args were parsed in one flat pass, so e.g. `docs show --json config` saw `--json` as a harmless
 * known boolean and kept `config` as the positional even though `show` itself never reads `--json`;
 * each gunshi sub-command must declare every family-wide flag in its own `args` too (even unused)
 * so gunshi's own per-command resolution doesn't re-trigger the same swallow bug this function
 * exists to prevent.
 */
/**
 * `gunshi/generator`'s `generate()` always renders a `-v, --version` line — it internally runs the
 * target command through gunshi's full `cli()`, whose hardcoded `global()` plugin force-adds
 * `-h`/`-v` to every command regardless of whether the command declares `version` itself (confirmed
 * empirically; undocumented in `@gunshi/docs`). Every hybrid-help surface except the root analyzer
 * lacks a working `--version` flag, so leaving that line in would advertise one — the exact
 * help-drift defect class this migration exists to kill. Strips exactly that one line from an
 * already-generated OPTIONS block; not used by the root analyzer, which has a real `--version`
 * flag and wants the generated line (matched to it by declaring `version` with the same wording).
 */
export function stripAutoVersionLine(generated: string): string {
  return generated
    .split('\n')
    .filter((line) => !/^\s*-v, --version\b/.test(line))
    .join('\n');
}

export function stripUnknownFlags(
  argv: string[],
  knownLong: ReadonlySet<string>,
  knownShort: ReadonlySet<string>
): string[] {
  const out: string[] = [];
  for (const token of argv) {
    if (token.startsWith('--')) {
      const name = token.slice(2).split('=')[0]!;
      if (knownLong.has(name)) out.push(token);
      continue;
    }
    if (token.startsWith('-') && token !== '-') {
      const survivors = token
        .slice(1)
        .split('')
        .filter((c) => knownShort.has(c));
      if (survivors.length > 0) out.push(`-${survivors.join('')}`);
      continue;
    }
    out.push(token);
  }
  return out;
}
