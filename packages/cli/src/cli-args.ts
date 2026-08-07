import { parseArgs } from 'node:util';

/** Parsed argv: positionals under `_`, flag values as flat keys. */
export interface CliArgv {
  _: string[];
  [flag: string]: unknown;
}

/**
 * Parse CLI flags with node:util's parseArgs. `strict: false` keeps unknown-flag
 * passthrough: an unrecognized flag parses as a boolean instead of throwing.
 * Note a declared string flag with no value also parses as `true`, never `''`.
 */
export function parseCliArgs(
  args: string[],
  opts: { boolean?: string[]; string?: string[]; short?: Record<string, string> } = {}
): CliArgv {
  const options: Record<string, { type: 'boolean' | 'string'; short?: string }> = {};
  for (const name of opts.boolean ?? []) options[name] = { type: 'boolean' };
  for (const name of opts.string ?? []) options[name] = { type: 'string' };
  for (const [short, long] of Object.entries(opts.short ?? {})) options[long]!.short = short;
  const { values, positionals } = parseArgs({ args, options, strict: false, allowPositionals: true });
  // Under strict: false a declared boolean given `--flag=x` parses as the string
  // 'x'; mri treated `--flag=false` as off, so keep that meaning instead of
  // letting Boolean('false') silently invert it.
  for (const name of opts.boolean ?? []) {
    const v = values[name];
    if (typeof v === 'string') values[name] = v !== 'false';
  }
  return { _: positionals, ...values };
}

/** Splits a comma-separated string flag into trimmed, non-empty entries; non-string input (flag not passed) yields `[]`. */
export const toList = (v: unknown): string[] =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
