import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { generate } from 'gunshi/generator';
import { runInstall } from '../install/index.js';
import { parseInstallArgs, resolveInstallArgs } from '../install/args.js';
import { realIO, clackPrompts } from '../install/cli.js';
import { readPackageVersion } from '../version.js';
import { consoleIO, type CliIO } from '../cli-io.js';
import type { CliArgv } from '../resolve-args.js';
import { guardArgs, splitAtTerminator, stripUnknownFlags, stripAutoVersionLine } from './guard.js';
import { localizedOptionsSection, type Locale } from './locale.js';

/**
 * `--client`/`--app`/`--scope` are install's value-carrying flags — `scope` is gone as a real
 * setting (see `resolveInstallArgs`) but still needs guarding: an unguarded `--scope --force`
 * would let gunshi leave `--force` as its own (undeclared-for-scope's-purposes) flag instead of
 * legacy's actual behavior of consuming it as scope's literal string value, silently changing
 * whether --force ends up set at all.
 */
const VALUE_FLAGS = ['client', 'app', 'scope'] as const;
const BOOLEAN_FLAGS = ['yes', 'dry-run', 'force', 'refresh', 'help'] as const;
const KNOWN_LONG_FLAGS = new Set<string>([...VALUE_FLAGS, ...BOOLEAN_FLAGS]);
const KNOWN_SHORT_FLAGS = new Set(['y', 'h']);

/** Exported for gunshi/complete.ts — the completion tree's install args mirror this, never a second copy. */
export const INSTALL_ARGS = {
  client: {
    type: 'string',
    description:
      'Comma-separated: vite-plugin,vite-hooks,cursor-rules,config-file,ci-workflow\n' +
      '(skips the interactive picker; the picker groups these by category —\n' +
      'Vite integration, Agent rules, CI, Config file)\n' +
      'vite-plugin registers the build-mode plugin in vite.config.{ts,js,mjs}; vite-hooks\n' +
      'wires up the svelteVitalsHandle hook in src/hooks.server.{ts,js}, which improves the\n' +
      "live dashboard's per-route accuracy as you browse. --force does not apply\n" +
      'to either of these two — an existing registration is always left as-is.\n' +
      'cursor-rules writes a Cursor rules file (.cursor/rules/svelte-vitals.mdc),\n' +
      'generated from the current rule set; supports --force to regenerate.\n' +
      'The setup-svelte-vitals, improve-svelte and svelte-vitals Agent Skills are not\n' +
      'installed here — install them with `npx skills add oekazuma/svelte-vitals`.\n' +
      'config-file scaffolds svelte-vitals.config.{js,ts} with every option commented\n' +
      'out, auto-picking .ts (with defineConfig) when the project looks\n' +
      'TypeScript-oriented (tsconfig.json or vite.config.ts present) and\n' +
      "svelte-vitals is a declared dependency (defineConfig's import resolves at load\n" +
      'time); else the .js (ESM) default. Supports --force to regenerate the file\n' +
      "that's already there (its extension never changes on --force).\n" +
      'ci-workflow scaffolds .github/workflows/svelte-vitals.yml, the same file\n' +
      '`svelte-vitals ci install` writes standalone — pick it here to set it up in\n' +
      'the same pass as everything else; supports --force to regenerate. `svelte-vitals\n' +
      "ci upgrade` remains the way to bump an existing workflow's pinned action version."
  },
  app: {
    type: 'string',
    description:
      'Monorepo: the SvelteKit app directory the vite-plugin/vite-hooks/config-file\n' +
      'targets write into (e.g. --app apps/web). Without it, when the current\n' +
      "directory isn't itself a SvelteKit app, one detected app is used\n" +
      'automatically (with a notice), several prompt a picker on a TTY, and\n' +
      'non-interactive runs exit 2 asking for --app. All other targets\n' +
      '(cursor-rules, ci-workflow) always write at the current directory —\n' +
      'the repo root is their correct home.'
  },
  // Hidden: the flag is obsolete (see resolveInstallArgs), kept parseable only so it doesn't
  // fall through as an unrecognized flag and swallow a following positional — auto-usage.md
  // documents `hidden: true` as the way to keep an arg parseable without advertising it.
  scope: { type: 'string', hidden: true },
  yes: { type: 'boolean', short: 'y', description: 'Skip the confirmation prompt' },
  'dry-run': { type: 'boolean', description: 'Print the planned changes and exit without writing' },
  force: { type: 'boolean', description: 'Overwrite an existing svelte-vitals entry' },
  refresh: {
    type: 'boolean',
    description:
      'Regenerate an existing Cursor rules file (cursor-rules) with the current\n' +
      'rule set. Only regenerates a file already present on disk — it never creates\n' +
      'one. Cannot be combined with --client.'
  },
  help: { type: 'boolean', short: 'h', description: 'Show this help' }
} as const;

/**
 * Hybrid `install --help` text — same technique as `gunshi/docs.ts`'s `buildDocsHelpText`. Unlike
 * docs/explain/ci, `install` never prints its help text on an error path (the legacy dispatcher
 * only ever showed it for `--help`/`-h`), so there is no separate frozen constant to keep in sync.
 * ja-localized when `locale` is 'ja' (`docs/superpowers/specs/2026-08-11-cli-ja-help-design.md`).
 */
async function buildInstallHelpText(installCommand: Parameters<typeof generate>[1], locale: Locale): Promise<string> {
  // `./locales/ja.js` is imported dynamically, only on the `ja` branch — an English
  // invocation of this (already lazily-dispatched) surface never parses the ja strings.
  const ja = locale === 'ja' ? await import('./locales/ja.js') : undefined;
  const optionsSection = stripAutoVersionLine(
    await localizedOptionsSection(
      installCommand,
      'svelte-vitals install',
      locale,
      ja?.JA_ARG_DESCRIPTIONS.install ?? {}
    )
  );

  if (locale === 'ja') return ja!.installHelpJa(optionsSection);

  return `svelte-vitals install — set up the svelte-vitals Vite integration, Cursor rules, config file, and CI

Usage:
  svelte-vitals install [options]

${optionsSection}`;
}

/**
 * Validate+dispatch from an already-parsed `CliArgv`, shared by both the gunshi-parsed path and
 * the raw-argv fallback below — the two differ only in how `argv` was produced, never in what
 * happens with it, so there is exactly one place that decides help vs. resolve vs. run.
 */
async function dispatchInstall(
  argv: CliArgv,
  installCommand: Parameters<typeof generate>[1],
  io: CliIO,
  locale: Locale
): Promise<number> {
  if (argv.help) {
    io.log(await buildInstallHelpText(installCommand, locale));
    return 0;
  }
  const { flags, warnings, errors } = resolveInstallArgs(argv);
  for (const w of warnings) io.errorLog(w);
  for (const e of errors) io.errorLog(e);
  if (!flags) return 2;
  return runInstall(flags, realIO(), clackPrompts(), readPackageVersion());
}

/**
 * gunshi/bone port of `install/cli.ts`'s dispatch (design doc: Phase 3). The prompt/timer-holding
 * internals (`runInstall`, clack wiring, `realIO`) are untouched — only argument parsing, dispatch,
 * and help move to gunshi.
 *
 * Unlike the root analyzer's guard-error branch (always fatal — every `VALUE_FLAGS` guard hit is
 * also a `resolveArgs` error), a guard hit here is NOT always fatal: legacy accepts a bare trailing
 * `--client`/`--app`/`--scope` (parses to `true`, resolves as "not passed") and a bare `--scope=`
 * (warns, still proceeds) — shapes `guardArgs`'s pre-scan flags defensively because they're
 * indistinguishable, pre-parse, from the genuinely dangerous shapes (`--client --force` swallowing
 * `--force` as a literal value legacy would consume). So the fallback below re-runs the *entire*
 * legacy pipeline (`parseInstallArgs` → `dispatchInstall`) rather than synthesizing a guard error
 * and exiting 2 unconditionally — that reproduces both the fatal and the non-fatal shapes exactly,
 * at the cost of being coarser than the root analyzer's fallback.
 */
export async function runInstallCliGunshi(
  args: string[],
  io: CliIO = consoleIO,
  locale: Locale = 'en'
): Promise<number> {
  // `--` must be split off before guard/strip run — see guard.ts's `splitAtTerminator` doc
  // comment. `install` reads no positionals at all (legacy silently ignores stray ones), so `tail`
  // is never re-attached anywhere below — splitting still matters so a post-`--` token that merely
  // looks like a flag (`install -- --force`) never reaches guard/strip and gets misread as real.
  const { head } = splitAtTerminator(args);
  const guard = guardArgs(head, VALUE_FLAGS, BOOLEAN_FLAGS);

  let exitCode = 0;

  const installCommand = define({
    name: 'install',
    args: INSTALL_ARGS,
    run: async (ctx) => {
      exitCode = await dispatchInstall({ _: [], ...ctx.values }, installCommand, io, locale);
    }
  });

  // See the doc comment above for why this is a full pipeline replay, not a synthesized error.
  if (guard.errors.length > 0) {
    return dispatchInstall(parseInstallArgs(args), installCommand, io, locale);
  }

  const argvForGunshi = stripUnknownFlags(guard.argv, KNOWN_LONG_FLAGS, KNOWN_SHORT_FLAGS);
  await cli(argvForGunshi, installCommand, {
    name: 'svelte-vitals install',
    // Routes every internal gunshi write through a no-op — see docs.ts's identical note.
    usageSilent: true
  });

  return exitCode;
}
