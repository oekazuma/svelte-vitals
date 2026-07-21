/**
 * Static detection of a literal `build.minify: false` in a Vite config source
 * (PERF012). Pure module (design §8): callers read the file and pass the source
 * string. Uses the shared wrap parser; unlike `findSsrFalseOptOut` (which gets an
 * already-wrapped program and leaves the −1 shift to its caller), this function
 * takes the raw source and returns lines already shifted to the original
 * source's coordinates.
 */
import { parseModuleProgram } from './component-parse.js';
import { unwrapTs, collectTopLevelBindings } from './kit-module-parse.js';
import { lineOf } from './svelte-ast.js';

// Same pragmatic typing stance as component-parse.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/**
 * Non-computed property of an object literal, by key name (`build` or `'build'`).
 * Returns the LAST matching property, honoring JavaScript object semantics where
 * duplicate keys are resolved to the rightmost value.
 */
function propOf(obj: Node, name: string): Node | undefined {
  let found: Node | undefined;
  for (const p of obj.properties ?? []) {
    if (p?.type !== 'Property' || p.computed) continue;
    if (p.key?.type === 'Identifier' && p.key.name === name) found = p;
    else if (p.key?.type === 'Literal' && p.key.value === name) found = p;
  }
  return found;
}

/**
 * Resolve the default-exported config expression to an object literal:
 * `export default {…}`, `export default defineConfig({…})` (any call's first
 * argument — the callee name is not verified), or a same-file alias
 * (`const config = {…}; export default config`), with `satisfies`/`as`
 * unwrapped at every step. Function-form configs and anything else resolve to
 * undefined — the CLI channel is deliberately literal-only; the Vite plugin
 * channel sees the resolved value instead.
 */
function resolveConfigObject(program: Node): Node | undefined {
  let exported: Node | undefined;
  for (const stmt of program.body ?? []) {
    if (stmt?.type === 'ExportDefaultDeclaration') exported = stmt.declaration;
  }
  if (!exported) return undefined;
  let expr = unwrapTs(exported);
  if (expr?.type === 'Identifier') {
    const resolved = collectTopLevelBindings(program).get(expr.name);
    if (!resolved) return undefined;
    expr = unwrapTs(resolved);
  }
  if (expr?.type === 'CallExpression') {
    expr = expr.arguments?.[0] ? unwrapTs(expr.arguments[0]) : undefined;
  }
  return expr?.type === 'ObjectExpression' ? expr : undefined;
}

/**
 * The `build: { minify: false }` override, when present as a literal: returns the
 * `minify` property's 1-based line in the ORIGINAL source. Undefined for clean,
 * dynamic, or unparsable configs (never throws).
 */
export function findMinifyDisabled(source: string): { line: number } | undefined {
  let program: Node | undefined;
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
  const buildValue = build ? unwrapTs(build.value) : undefined;
  if (buildValue?.type !== 'ObjectExpression') return undefined;
  const minify = propOf(buildValue, 'minify');
  const minifyValue = minify ? unwrapTs(minify.value) : undefined;
  if (minifyValue?.type !== 'Literal' || minifyValue.value !== false) return undefined;
  return { line: Math.max(0, lineOf(wrapped, minify.start) - 1) };
}
