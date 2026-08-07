/**
 * Generic resolution of a JS config file's exported object literal, shared by the
 * Vite-config and svelte.config parsers. Pure module (design §8): callers pass an
 * already-parsed ESTree program.
 */
import type { Expression, ObjectExpression, Program, Property } from 'estree';
import { unwrapTs, type TsExpression } from './component-parse.js';
import { collectTopLevelBindings } from './kit-module-parse.js';

/**
 * Non-computed property of an object literal, by key name (`build` or `'build'`).
 * Returns the LAST matching property, honoring JavaScript object semantics where
 * duplicate keys are resolved to the rightmost value — UNLESS a `SpreadElement`
 * appears after that match in the same object literal, in which case the spread
 * could re-introduce or overwrite the key at runtime and the effective value is
 * unknowable, so this conservatively returns undefined. A spread BEFORE the
 * match doesn't matter — the literal property still wins.
 */
export function propOf(obj: ObjectExpression, name: string): Property | undefined {
  let found: Property | undefined;
  for (const p of obj.properties) {
    if (p.type === 'SpreadElement') {
      if (found) found = undefined; // a match already found is now unknowable
      continue;
    }
    if (p.type !== 'Property' || p.computed) continue;
    if (p.key.type === 'Identifier' && p.key.name === name) found = p;
    else if (p.key.type === 'Literal' && p.key.value === name) found = p;
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
export function unwrapToObjectExpression(
  expr: TsExpression | undefined,
  bindings: Map<string, TsExpression>
): ObjectExpression | undefined {
  let current: TsExpression | undefined = expr;
  for (let i = 0; i < 4 && current; i++) {
    const e = unwrapTs(current);
    if (e.type === 'ObjectExpression') return e;
    if (e.type === 'Identifier') {
      current = bindings.get(e.name);
      continue;
    }
    if (e.type === 'CallExpression') {
      current = e.arguments[0] as Expression | undefined;
      continue;
    }
    return undefined;
  }
  const final = current ? unwrapTs(current) : undefined;
  return final?.type === 'ObjectExpression' ? final : undefined;
}

/**
 * The exported config expression's raw (un-unwrapped) node: an ESM
 * `export default …` declaration, or — when no default export exists — the
 * RHS of the LAST top-level CJS `module.exports = …` assignment (mirrors
 * JavaScript's last-assignment-wins semantics, same rationale as `propOf`'s
 * last-wins). Undefined when neither form is present.
 */
function findExportedExpression(program: Program): Expression | undefined {
  let exported: Expression | undefined;
  for (const stmt of program.body) {
    if (stmt.type === 'ExportDefaultDeclaration') exported = stmt.declaration as Expression;
  }
  if (exported) return exported;

  let cjsExported: Expression | undefined;
  for (const stmt of program.body) {
    if (stmt.type !== 'ExpressionStatement') continue;
    const expr = stmt.expression;
    if (expr.type !== 'AssignmentExpression' || expr.operator !== '=') continue;
    const left = expr.left;
    if (
      left.type === 'MemberExpression' &&
      !left.computed &&
      left.object.type === 'Identifier' &&
      left.object.name === 'module' &&
      left.property.type === 'Identifier' &&
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
export function resolveConfigObject(program: Program): ObjectExpression | undefined {
  const exported = findExportedExpression(program);
  if (!exported) return undefined;
  return unwrapToObjectExpression(exported, collectTopLevelBindings(program));
}
