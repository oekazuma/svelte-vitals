import { generate } from 'gunshi/generator';

/**
 * Only `--help` output is ever localized (design doc: `docs/superpowers/specs/2026-08-11-cli-ja-help-design.md`)
 * — errors, warnings, and reporter output stay English regardless of this value.
 */
export type Locale = 'en' | 'ja';

/** POSIX first-non-empty-wins — the first of these that is set (even to a non-Japanese value) decides. */
const ENV_PRECEDENCE = ['SVELTE_VITALS_LANG', 'LC_ALL', 'LC_MESSAGES', 'LANG'] as const;

/** `ja_JP.UTF-8` / `ja-JP` / `ja` → `'ja'`; anything else (including garbage) → `'en'`. */
function canonicalize(raw: string): Locale {
  const base = raw.split('.')[0]!.replaceAll('_', '-').split('-')[0]!.toLowerCase();
  return base === 'ja' ? 'ja' : 'en';
}

export function resolveLocale(env: Readonly<Record<string, string | undefined>>): Locale {
  for (const key of ENV_PRECEDENCE) {
    const value = env[key];
    if (value) return canonicalize(value);
  }
  return 'en';
}

/**
 * `@gunshi/plugin-i18n` treats any arg literally named `help`/`version` as one of its own "common
 * args" — confirmed empirically against 0.37.1 by reading the plugin's own source
 * (`node_modules/@gunshi/plugin-i18n/lib/index.js`): its `extension()` self-registers a resource
 * for exactly those two keys (its own English default, `en_US_default.help`/`.version`) BEFORE any
 * command's own `resource()` fetcher or `arg:help`/`arg:version` key is ever consulted, and a
 * `registerGlobalOptionResources('help', …)` call from outside is a guarded no-op once that
 * self-registration has happened (probed empirically: a companion plugin depending on `g:i18n`
 * cannot override it either, regardless of plugin order). The only supported override is
 * `i18n({ builtinResources })` — which this design deliberately never passes (it also carries
 * error-message resources, and localizing those is explicitly out of scope). So every `help`/
 * `--help` OPTIONS row renders the plugin's own "Display this help message"/"Display this
 * version" under `ja`, not our `description`/ja text, no matter how the command is wrapped.
 * Patched back out here, literal and targeted (never a general find/replace) — the same shape as
 * `guard.ts`'s `stripAutoVersionLine` for a sibling gunshi quirk. `gunshi-i18n-common-args.test.ts`
 * pins the two literal English strings so a gunshi bump that changes them fails loudly instead of
 * silently leaving this substitution a no-op.
 */
const COMMON_ARG_EN_DEFAULTS = { help: 'Display this help message', version: 'Display this version' } as const;

/**
 * Renders `command`'s OPTIONS block (the slice every help builder in this directory keeps from a
 * `generate()` call — header/usage/footer are this CLI's own hand-written prose, never gunshi's).
 *
 * The `en` branch is the exact call every help builder made before this feature existed — kept
 * byte-for-byte unchanged (not merely equivalent) so a bug in the `ja` branch below can never move
 * the English golden output. Empirically the two ARE byte-identical even when `ja`'s machinery runs
 * under an English locale (an empty resource object leaves every arg's original `description`
 * untouched), but the `en` branch skips that machinery entirely rather than relying on it —
 * including skipping the dynamic `@gunshi/plugin-i18n` import below, which the analyzer's hot path
 * (the hand-written `--help`/`--version` args aside, every plain analyze run) must never pay for.
 *
 * `@gunshi/plugin-i18n`'s resource lookup keys off the RAW `ArgSchema` object key (`arg:noColor`),
 * never the kebab-cased name it renders as (confirmed empirically against 0.37.1, undocumented) —
 * `jaArgDescriptions` must be keyed the same way `ROOT_ARGS`/etc. are (e.g. `noColor`, not
 * `no-color`). A ja key absent from `jaArgDescriptions` falls back to the arg's own English
 * `description` at render time (the plugin's own behavior, verified empirically) — never a blank —
 * EXCEPT for `help`/`version`, see `COMMON_ARG_EN_DEFAULTS` above.
 */
export async function localizedOptionsSection(
  command: Parameters<typeof generate>[1],
  name: string,
  locale: Locale,
  jaArgDescriptions: Readonly<Record<string, string>>
): Promise<string> {
  let generated: string;
  if (locale === 'en') {
    generated = await generate(null, command, { name, renderHeader: null });
  } else {
    const { default: i18n, withI18nResource } = await import('@gunshi/plugin-i18n');
    generated = await generate(
      null,
      // `description` (the command-level, not per-arg, resource key) is required by
      // `CommandResource`'s type but never read here — every caller slices from `OPTIONS:`
      // onward, discarding whatever header text it would have driven.
      withI18nResource(command, (l) => ({
        description: '',
        ...(l.toString() === 'ja'
          ? Object.fromEntries(Object.entries(jaArgDescriptions).map(([key, text]) => [`arg:${key}`, text]))
          : {})
      })),
      { name, renderHeader: null, plugins: [i18n({ locale: 'ja' })] }
    );
    for (const [key, enDefault] of Object.entries(COMMON_ARG_EN_DEFAULTS)) {
      const ja = jaArgDescriptions[key];
      if (ja) generated = generated.replaceAll(enDefault, ja);
    }
  }
  const optionsIndex = generated.indexOf('OPTIONS:');
  return optionsIndex === -1 ? generated.trimEnd() : generated.slice(optionsIndex).trimEnd();
}
