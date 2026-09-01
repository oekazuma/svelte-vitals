/**
 * Static extraction of `kit.paths.base` (correctness/base-path-navigation). Pure module
 * (design §8): callers read the files and pass the source strings. Two config homes are
 * supported, in SvelteKit's own precedence — `sveltekit(<config>)` in a Vite config wins and
 * makes `svelte.config` irrelevant (SvelteKit logs "svelte.config.js is ignored when options
 * are passed via your Vite config"), otherwise `svelte.config.{js,ts}` is read. Never throws.
 */
import type { Expression, ObjectExpression, Program, Property } from 'estree';
import { collectNamedImportAliases, parseModuleProgram, unwrapTs, type TsExpression } from './module-ast.js';
import { collectTopLevelBindings } from './kit-module-parse.js';
import { propOf, resolveConfigObject, unwrapToObjectExpression } from './config-object.js';
import type { KitAlias } from './types.js';

/** What a Vite config says about SvelteKit's own configuration. */
export type ViteKitConfigResult =
  /** No `sveltekit()` call, or one with no argument — `svelte.config` still applies. */
  | { kind: 'no-plugin-config' }
  /** `sveltekit(<something we can't resolve>)` — the effective config is unknowable AND
   *  `svelte.config` is provably ignored, so the caller must stay quiet. */
  | { kind: 'unresolvable' }
  /** `sveltekit({…})` resolved. `base` is unset when the config declares no non-empty base. */
  | { kind: 'resolved'; base?: { value?: string } };

/**
 * `paths.base` off a resolved Kit-config object: `{ value }` for a non-empty string literal,
 * `{}` for any other expression (base exists, value unknowable — the `dev ? '' : '/repo'`
 * deploy form), and undefined when absent or an explicit empty string.
 */
function basePathOf(kitConfig: ObjectExpression, bindings: Map<string, TsExpression>): { value?: string } | undefined {
  const paths = propOf(kitConfig, 'paths');
  const pathsObj = paths ? unwrapToObjectExpression(paths.value as Expression, bindings) : undefined;
  if (!pathsObj) return undefined;
  const base = propOf(pathsObj, 'base');
  if (!base) return undefined;
  const value = unwrapTs(base.value as Expression);
  if (value.type === 'Literal') {
    return typeof value.value === 'string' && value.value !== '' ? { value: value.value } : undefined;
  }
  return {};
}

/** `kit.alias` and `kit.files.lib` as written, before Kit compiles them into ordered entries. */
export type RawKitAliases = {
  /**
   * `kit.alias` entries in declaration order, `value: null` where the config's value is not a
   * string literal. **Undefined means the key set is unknowable** — a spread or a computed key
   * puts an unknown key at a known position, and an unknown key could shadow anything after it,
   * with no `find` to record that with. The caller then discards every user entry.
   */
  entries?: { key: string; value: string | null }[];
  /**
   * `kit.files.lib`, in three distinct states: **absent** (`undefined`) — there is no `lib`
   * property, or `files` itself does not resolve to an object literal; a **literal** (the
   * string) — `files.lib` is a string literal; **present but unreadable** (`null`) — the `lib`
   * property exists but its value is not statically a string (e.g. a computed expression). The
   * `null` state must not collapse into "absent": the caller cannot fall back to `src/lib`
   * without risking a wrong answer, because the project may have moved `$lib` to something this
   * parser simply couldn't read.
   */
  filesLib?: string | null;
};

/** A property's key when it is a plain (non-computed) string or identifier key. */
function keyNameOf(p: Property): string | undefined {
  if (p.computed) return undefined;
  if (p.key.type === 'Identifier') return p.key.name;
  if (p.key.type === 'Literal' && typeof p.key.value === 'string') return p.key.value;
  return undefined;
}

/** A property's value when it is a string literal, else undefined. */
function stringValueOf(p: Property): string | undefined {
  const v = unwrapTs(p.value as Expression);
  return v.type === 'Literal' && typeof v.value === 'string' ? v.value : undefined;
}

/**
 * `kit.alias`'s entries in source order. Undefined when the key set cannot be known (see
 * `RawKitAliases.entries`); `[]` when `propOf` finds no `alias` property — which also covers the
 * case where a spread in the `kit` object could have supplied one, matching how every other
 * fact in this file treats that unknowability rather than inventing a stricter rule for alias
 * alone. Duplicate literal keys collapse the way `Object.entries` does — FIRST position, LAST
 * value — because that is the object Kit iterates.
 */
function aliasEntriesOf(kitConfig: ObjectExpression, bindings: Map<string, TsExpression>): RawKitAliases['entries'] {
  const alias = propOf(kitConfig, 'alias');
  if (!alias) return [];
  const obj = unwrapToObjectExpression(alias.value as Expression, bindings);
  if (!obj) return undefined;
  const out: { key: string; value: string | null }[] = [];
  const at = new Map<string, number>();
  for (const p of obj.properties) {
    if (p.type !== 'Property') return undefined; // a spread: unknown keys at a known position
    const key = keyNameOf(p);
    if (key === undefined) return undefined; // a computed key: could match, and shadow, anything
    const entry = { key, value: stringValueOf(p) ?? null };
    const seen = at.get(key);
    if (seen === undefined) {
      at.set(key, out.length);
      out.push(entry);
    } else out[seen] = entry;
  }
  return out;
}

/**
 * `kit.files.lib` in the three states documented on `RawKitAliases.filesLib`: `undefined` when
 * there is no `lib` property to read (including when `files` itself doesn't resolve to an object
 * literal), `null` when `lib` exists but is not statically a string, else the string.
 */
function filesLibOf(kitConfig: ObjectExpression, bindings: Map<string, TsExpression>): string | null | undefined {
  const files = propOf(kitConfig, 'files');
  const obj = files ? unwrapToObjectExpression(files.value as Expression, bindings) : undefined;
  const lib = obj ? propOf(obj, 'lib') : undefined;
  if (!lib) return undefined;
  return stringValueOf(lib) ?? null;
}

/** `kit.alias` and `kit.files.lib` from a `svelte.config.{js,ts}` source. */
export function findKitAliasesInSvelteConfig(source: string): RawKitAliases {
  const program = programOf(source, 'svelte.config.js');
  const config = program ? resolveConfigObject(program) : undefined;
  if (!program || !config) return { entries: [] };
  const bindings = collectTopLevelBindings(program);
  const kit = propOf(config, 'kit');
  const kitObj = kit ? unwrapToObjectExpression(kit.value as Expression, bindings) : undefined;
  if (!kitObj) return { entries: [] };
  const filesLib = filesLibOf(kitObj, bindings);
  return { entries: aliasEntriesOf(kitObj, bindings), ...(filesLib !== undefined ? { filesLib } : {}) };
}

/**
 * The normalisation Kit applies to an alias value — `posixify`, then a trailing `/*` stripped —
 * plus the trailing-slash trim that Kit gets for free from `path.resolve` and this parser does
 * not (it works in project-relative strings and never resolves). Applied to the `$lib` entry
 * too, which Kit builds with neither step: `kit.files.lib` is a user-written string with the
 * same irregularities available to it.
 */
function normalizeAliasValue(value: string): string {
  const posix = value.replace(/\\/g, '/');
  const noStar = posix.endsWith('/*') ? posix.slice(0, -2) : posix;
  return noStar.replace(/\/+$/, '');
}

/**
 * Compile raw config values into Kit's ordered entry list: `$lib` first (from `kit.files.lib`,
 * else `src/lib`), then the user's entries in declaration order. Modes come from the DECLARED
 * key set — `key + '/*'` present makes the plain key exact — never from the subset whose values
 * happened to be readable. `raw.filesLib === null` (a `kit.files.lib` present but not statically a
 * string) compiles to an opaque `$lib` entry, `replacement: null` — `??` would otherwise collapse
 * that into the `src/lib` default, which is a wrong answer, not a missing one, for a project that
 * moved `$lib` to something this parser couldn't read.
 */
function compileKitAliases(raw: RawKitAliases): KitAlias[] {
  const filesLib = raw.filesLib === null ? null : normalizeAliasValue(raw.filesLib ?? 'src/lib');
  const out: KitAlias[] = [{ find: '$lib', replacement: filesLib, match: 'prefix' }];
  const entries = raw.entries ?? [];
  const declared = new Set(entries.map((e) => e.key));
  for (const { key, value } of entries) {
    const star = key.endsWith('/*');
    out.push({
      find: star ? key.slice(0, -2) : key,
      replacement: value === null ? null : normalizeAliasValue(value),
      match: star ? 'contents' : declared.has(`${key}/*`) ? 'exact' : 'prefix'
    });
  }
  return out;
}

/**
 * The project's compiled alias list, following SvelteKit's config precedence: options passed to
 * the `sveltekit()` Vite plugin make `svelte.config` irrelevant (Kit logs "svelte.config.js is
 * ignored when options are passed via your Vite config"), so aliases are read from
 * `svelte.config` only when the Vite config carries no plugin config. Reading `kit.alias` out of
 * a plugin config is deliberately not done — that costs reach, not correctness, and such a
 * project keeps the resolver's default `$lib` behaviour. Undefined means "no config was read".
 */
export function resolveKitAliases(
  viteConfig: { source: string } | undefined,
  svelteConfig: { source: string } | undefined
): KitAlias[] | undefined {
  if (viteConfig && findKitPathsBaseInViteConfig(viteConfig.source).kind !== 'no-plugin-config') return undefined;
  if (!svelteConfig) return undefined;
  return compileKitAliases(findKitAliasesInSvelteConfig(svelteConfig.source));
}

/** Parse a config source to a program, or undefined when it cannot be parsed. */
function programOf(source: string, filename: string): Program | undefined {
  try {
    return parseModuleProgram(source, filename).program ?? undefined;
  } catch {
    return undefined;
  }
}

/** `kit.paths.base` from a `svelte.config.{js,ts}` source. */
export function findKitPathsBaseInSvelteConfig(source: string): { value?: string } | undefined {
  const program = programOf(source, 'svelte.config.js');
  if (!program) return undefined;
  const config = resolveConfigObject(program);
  if (!config) return undefined;
  const bindings = collectTopLevelBindings(program);
  const kit = propOf(config, 'kit');
  const kitObj = kit ? unwrapToObjectExpression(kit.value as Expression, bindings) : undefined;
  return kitObj ? basePathOf(kitObj, bindings) : undefined;
}

/**
 * Local names bound to `sveltekit` imported from '@sveltejs/kit/vite'. When no such import is
 * found (an unusual or unparsed import form), the bare name `sveltekit` is assumed — the call
 * shape is distinctive enough that a false match is not a realistic concern.
 */
function sveltekitLocalNames(program: Program): Set<string> {
  const out = collectNamedImportAliases(program, '@sveltejs/kit/vite', new Set(['sveltekit']));
  if (out.size === 0) out.add('sveltekit');
  return out;
}

/** SvelteKit config passed to the `sveltekit()` plugin in a Vite config source (since Kit 2.62). */
export function findKitPathsBaseInViteConfig(source: string): ViteKitConfigResult {
  const none: ViteKitConfigResult = { kind: 'no-plugin-config' };
  const program = programOf(source, 'vite.config.ts');
  if (!program) return none;
  const config = resolveConfigObject(program);
  if (!config) return none;
  const bindings = collectTopLevelBindings(program);
  const plugins = propOf(config, 'plugins');
  const pluginsValue = plugins ? unwrapTs(plugins.value as Expression) : undefined;
  if (pluginsValue?.type !== 'ArrayExpression') return none;

  const locals = sveltekitLocalNames(program);
  for (const el of pluginsValue.elements) {
    if (!el || el.type === 'SpreadElement') continue;
    const call = unwrapTs(el as Expression);
    if (call.type !== 'CallExpression') continue;
    if (call.callee.type !== 'Identifier' || !locals.has(call.callee.name)) continue;
    const arg = call.arguments[0] as Expression | undefined;
    if (arg === undefined) return none; // sveltekit() — svelte.config still applies
    const kitConfig = unwrapToObjectExpression(arg, bindings);
    if (!kitConfig) return { kind: 'unresolvable' };
    const base = basePathOf(kitConfig, bindings);
    return base ? { kind: 'resolved', base } : { kind: 'resolved' };
  }
  return none;
}

/**
 * The project's effective `kit.paths.base`, following SvelteKit's precedence: the `sveltekit()`
 * plugin config when it carries one, otherwise `svelte.config`. `file` is the config the base
 * came from (as passed in by the caller). Undefined means "no base path" — the gate stays shut.
 */
export function resolveKitPathsBase(
  viteConfig: { file: string; source: string } | undefined,
  svelteConfig: { file: string; source: string } | undefined
): { value?: string; file: string } | undefined {
  if (viteConfig) {
    const result = findKitPathsBaseInViteConfig(viteConfig.source);
    if (result.kind === 'unresolvable') return undefined;
    if (result.kind === 'resolved') {
      return result.base ? { ...result.base, file: viteConfig.file } : undefined;
    }
  }
  if (!svelteConfig) return undefined;
  const base = findKitPathsBaseInSvelteConfig(svelteConfig.source);
  return base ? { ...base, file: svelteConfig.file } : undefined;
}
