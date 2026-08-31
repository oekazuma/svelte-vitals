/**
 * Static detection of a literal `build.minify: false` in a Vite config source
 * (performance/minify-disabled). Pure module (design §8): callers read the file and pass the source
 * string. Uses the shared wrap parser; unlike `findFalseOptOut` (which gets an
 * already-wrapped program and leaves the −1 shift to its caller), this function
 * takes the raw source and returns lines already shifted to the original
 * source's coordinates. Supports ESM (`export default {…}` /
 * `defineConfig({…})` / a same-file alias, including a same-file identifier
 * passed as `defineConfig`'s argument) and CJS (`module.exports = {…}`) forms.
 */
import type { Expression, Program, Property } from 'estree';
import { parseModuleProgram, unwrapTs } from './module-ast.js';
import { propOf, resolveConfigObject } from './config-object.js';
import { lineOf } from './svelte-ast.js';

/**
 * The `build: { minify: false }` override, when present as a literal: returns the
 * `minify` property's 1-based line in the ORIGINAL source. Undefined for clean,
 * dynamic, or unparsable configs (never throws).
 */
export function findMinifyDisabled(source: string): { line: number } | undefined {
  let program: Program | undefined;
  let wrapped: string;
  try {
    ({ program, wrapped } = parseModuleProgram(source, 'vite.config.ts'));
  } catch {
    return undefined; // malformed config source — never throw (spec)
  }
  if (!program) return undefined;
  const config = resolveConfigObject(program);
  if (!config) return undefined;
  const build = propOf(config, 'build');
  const buildValue = build ? unwrapTs(build.value as Expression) : undefined;
  if (buildValue?.type !== 'ObjectExpression') return undefined;
  const minify = propOf(buildValue, 'minify');
  const minifyValue = minify ? unwrapTs(minify.value as Expression) : undefined;
  if (!minify || minifyValue?.type !== 'Literal' || minifyValue.value !== false) return undefined;
  // acorn attaches start/end offsets that @types/estree's BaseNode doesn't declare.
  return { line: Math.max(0, lineOf(wrapped, (minify as Property & { start: number }).start) - 1) };
}
