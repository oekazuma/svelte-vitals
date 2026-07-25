/**
 * Static extraction of `kit.paths.base` (correctness/base-path-navigation). Pure module
 * (design §8): callers read the files and pass the source strings. Two config homes are
 * supported, in SvelteKit's own precedence — `sveltekit(<config>)` in a Vite config wins and
 * makes `svelte.config` irrelevant (SvelteKit logs "svelte.config.js is ignored when options
 * are passed via your Vite config"), otherwise `svelte.config.{js,ts}` is read. Never throws.
 */
import type { Expression, ObjectExpression, Program } from 'estree';
import { collectNamedImportAliases, parseModuleProgram, unwrapTs, type TsExpression } from './component-parse.js';
import { collectTopLevelBindings } from './kit-module-parse.js';
import { propOf, resolveConfigObject, unwrapToObjectExpression } from './config-object.js';

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
