/**
 * Static detection of a literal `build.minify: false` in a Vite config source
 * (PERF012). Pure module (design §8): callers read the file and pass the source
 * string. Uses the shared wrap parser; unlike `findSsrFalseOptOut` (which gets an
 * already-wrapped program and leaves the −1 shift to its caller), this function
 * takes the raw source and returns lines already shifted to the original
 * source's coordinates. Supports ESM (`export default {…}` /
 * `defineConfig({…})` / a same-file alias, including a same-file identifier
 * passed as `defineConfig`'s argument) and CJS (`module.exports = {…}`) forms.
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
 * duplicate keys are resolved to the rightmost value — UNLESS a `SpreadElement`
 * appears after that match in the same object literal, in which case the spread
 * could re-introduce or overwrite the key at runtime and the effective value is
 * unknowable, so this conservatively returns undefined. A spread BEFORE the
 * match doesn't matter — the literal property still wins.
 */
function propOf(obj: Node, name: string): Node | undefined {
  let found: Node | undefined;
  for (const p of obj.properties ?? []) {
    if (p?.type === 'SpreadElement') {
      if (found) found = undefined; // a match already found is now unknowable
      continue;
    }
    if (p?.type !== 'Property' || p.computed) continue;
    if (p.key?.type === 'Identifier' && p.key.name === name) found = p;
    else if (p.key?.type === 'Literal' && p.key.value === name) found = p;
  }
  return found;
}

/**
 * Unwrap an expression to an object literal, resolving up to 4 steps of: TS
 * wrappers (`satisfies`/`as`), an `Identifier` through same-file top-level
 * `bindings`, and a `CallExpression`'s first argument (so both
 * `defineConfig({…})` and `defineConfig(config)` — a same-file identifier
 * argument — resolve, and so does either nested inside the other). Stops as
 * soon as an `ObjectExpression` is reached, or when a step can't make further
 * progress (an unresolvable identifier, or anything else that isn't a wrapper,
 * identifier, or call).
 */
function unwrapToObjectExpression(expr: Node, bindings: Map<string, Node>): Node | undefined {
  for (let i = 0; i < 4 && expr; i++) {
    expr = unwrapTs(expr);
    if (expr?.type === 'ObjectExpression') return expr;
    if (expr?.type === 'Identifier') {
      expr = bindings.get(expr.name);
      continue;
    }
    if (expr?.type === 'CallExpression') {
      expr = expr.arguments?.[0];
      continue;
    }
    return undefined;
  }
  return expr?.type === 'ObjectExpression' ? expr : undefined;
}

/**
 * The exported config expression's raw (un-unwrapped) node: an ESM
 * `export default …` declaration, or — when no default export exists — the
 * RHS of the LAST top-level CJS `module.exports = …` assignment (mirrors
 * JavaScript's last-assignment-wins semantics, same rationale as `propOf`'s
 * last-wins). Undefined when neither form is present.
 */
function findExportedExpression(program: Node): Node | undefined {
  let exported: Node | undefined;
  for (const stmt of program.body ?? []) {
    if (stmt?.type === 'ExportDefaultDeclaration') exported = stmt.declaration;
  }
  if (exported) return exported;

  let cjsExported: Node | undefined;
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExpressionStatement') continue;
    const expr = stmt.expression;
    if (expr?.type !== 'AssignmentExpression' || expr.operator !== '=') continue;
    const left = expr.left;
    if (
      left?.type === 'MemberExpression' &&
      !left.computed &&
      left.object?.type === 'Identifier' &&
      left.object.name === 'module' &&
      left.property?.type === 'Identifier' &&
      left.property.name === 'exports'
    ) {
      cjsExported = expr.right;
    }
  }
  return cjsExported;
}

/**
 * Resolve the exported config expression to an object literal: ESM
 * `export default {…}`, `export default defineConfig({…})` (any call's first
 * argument — the callee name is not verified), a same-file alias
 * (`const config = {…}; export default config`) including one passed as
 * `defineConfig`'s argument, or CJS `module.exports = {…}` in the same forms —
 * with `satisfies`/`as` unwrapped at every step. Function-form configs and
 * anything else resolve to undefined — the CLI channel is deliberately
 * literal-only; the Vite plugin channel sees the resolved value instead.
 */
function resolveConfigObject(program: Node): Node | undefined {
  const exported = findExportedExpression(program);
  if (!exported) return undefined;
  return unwrapToObjectExpression(exported, collectTopLevelBindings(program));
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
