import { parse, type AST } from 'svelte/compiler';
import type { Value } from './types.js';

/**
 * `<style lang="scss">` and friends. The leading `\s` before `lang` is what keeps `data-lang` out.
 * This is a text scan, not a parse, so it can also match style-like text inside a script string or
 * an attribute — which is why it only ever runs on a source Svelte has already refused.
 */
const PREPROCESSED_STYLE_RE = /(<style\b[^>]*\slang\s*=\s*['"]?[^'"\s>]+['"]?[^>]*>)([\s\S]*?)(<\/style>)/gi;

/**
 * Parse a `.svelte` source, tolerating style blocks written in a CSS dialect.
 *
 * Svelte parses a `<style>` body as CSS whatever its `lang` says, so one `<style lang="scss">`
 * makes a component unparseable — and one unparseable route file fails the entire run. On failure
 * the dialect bodies are blanked to spaces of the same length (nothing here reads CSS, and equal
 * length keeps every byte offset, so reported lines are unchanged) and the parse is retried.
 *
 * The retry, not the substitution, is the design: a file that parses today is never rewritten, so
 * the text scan's imprecision cannot reach it. A file that does not parse is already a hard failure,
 * which the retry can only improve on.
 */
export function parseSvelte(source: string, filename: string): AST.Root {
  try {
    return parse(source, { modern: true, filename });
  } catch (err) {
    const blanked = source.replace(
      PREPROCESSED_STYLE_RE,
      (_m, open: string, body: string, close: string) => open + body.replace(/[^\n]/g, ' ') + close
    );
    if (blanked === source) throw err;
    return parse(blanked, { modern: true, filename });
  }
}

/** A template fragment's child node relevant to value classification: literal text or a `{expr}`. */
type TextOrExpr = AST.Text | AST.ExpressionTag;

/**
 * All keys that can bear child nodes in a Svelte AST node.
 * Covers if/each/await blocks (pending/then/catch/fallback) as well as
 * the standard fragment, nodes, consequent, alternate, and body keys.
 */
export const CHILD_NODE_KEYS = [
  'fragment',
  'nodes',
  'consequent',
  'alternate',
  'body',
  'pending',
  'then',
  'catch',
  'fallback'
];

/**
 * Determine a value's kind from a list of child/text nodes (design §4, §11):
 *   - any ExpressionTag present  → 'dynamic' (e.g. {data.title}); we do NOT
 *     follow the expression — that would turn this into runtime analysis.
 *   - non-whitespace Text only   → 'static'
 *   - empty / whitespace only    → 'absent'
 */
const hasExpression = (nodes: TextOrExpr[]) => nodes.some((n) => n?.type === 'ExpressionTag');

/** Concatenated literal text of a node list (non-Text nodes ignored, no trim). */
function joinText(nodes: TextOrExpr[]): string {
  return nodes
    .filter((n): n is AST.Text => n?.type === 'Text')
    .map((n) => String(n.data ?? ''))
    .join('');
}

export function valueFromNodes(nodes: TextOrExpr[]): Value {
  if (!Array.isArray(nodes)) return 'absent';
  if (hasExpression(nodes)) return 'dynamic';
  return joinText(nodes).trim().length > 0 ? 'static' : 'absent';
}

/** The literal text of a node list when fully static (no ExpressionTag), else undefined. */
export function textFromNodes(nodes: TextOrExpr[]): string | undefined {
  if (!Array.isArray(nodes) || hasExpression(nodes)) return undefined;
  const text = joinText(nodes);
  return text.trim().length > 0 ? text : undefined;
}

/** Static string of an attribute (e.g. name="description"), or undefined if dynamic/absent. */
export function attrText(attributes: AST.Attribute[], name: string): string | undefined {
  const v = findAttr(attributes, name)?.value;
  if (v === true) return '';
  if (!Array.isArray(v) || hasExpression(v)) return undefined; // single ExpressionTag → not a literal
  return joinText(v);
}

/** Value kind of an attribute's content (e.g. the `content` of a <meta>). */
export function attrValue(attributes: AST.Attribute[], name: string): Value {
  const attr = findAttr(attributes, name);
  return attr ? attrValueOf(attr) : 'absent';
}

export function lineOf(source: string, offset: unknown): number {
  if (typeof offset !== 'number' || offset < 0) return 0;
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) if (source[i] === '\n') line++;
  return line;
}

/**
 * An element's attribute by name, matched **case-insensitively**: HTML attribute names are, so
 * `ARIA-LABEL` and `Type` are the same attributes as `aria-label` and `type` once the document is
 * parsed. The Svelte AST keeps the source spelling, so the normalisation has to happen here.
 *
 * Only ever called with an HTML element's attributes. A component's props are case-**sensitive**
 * (`<Foo titleTemplate>` is not `<Foo titletemplate>`) and are read through the adapters' own
 * lookup, which must stay exact.
 */
export function findAttr(attributes: AST.Attribute[], name: string): AST.Attribute | undefined {
  if (!Array.isArray(attributes)) return undefined;
  const wanted = name.toLowerCase();
  return attributes.find(
    (a) => a?.type === 'Attribute' && typeof a.name === 'string' && a.name.toLowerCase() === wanted
  );
}

/** Value kind of a single attribute (e.g. a component prop). */
export function attrValueOf(attr: AST.Attribute): Value {
  const v = attr?.value;
  if (v === true) return 'absent'; // boolean attribute, no content
  if (Array.isArray(v)) return valueFromNodes(v);
  if (v && v.type === 'ExpressionTag') return 'dynamic'; // content={expr}
  return 'absent';
}

/** Literal static text of a single attribute node (e.g. a component prop), or undefined if dynamic/absent. */
export function attrTextOf(attr: AST.Attribute): string | undefined {
  const v = attr?.value;
  return Array.isArray(v) ? textFromNodes(v) : undefined;
}
