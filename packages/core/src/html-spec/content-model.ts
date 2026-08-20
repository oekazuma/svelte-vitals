import type { ElementFact } from '../component.js';
import { HTML_SPEC } from './generated.js';

/**
 * Content-model membership evaluation for `a11y/permitted-contents`, over the vendored
 * `contentModel` data. Ports the measurement probe's reviewed semantics
 * (docs/superpowers/specs/2026-08-20-permitted-contents-measured.md, rule design
 * 2026-08-20-permitted-contents-rule-design.md): per-child membership only — never sequence or
 * cardinality — three-valued, with every unknown resolving toward silence.
 */

type Tri = boolean | 'unknown';

export interface ContentJudgment {
  verdict: 'violation';
  /**
   * The effective entry set that rejected the child admits no category besides
   * script-supporting — the closed containers (`ul`, `table`, `select`, …), where a violation
   * breaks structure assistive tech relies on. Drives the warning/info severity split.
   */
  closedModel: boolean;
  /** Human description of what the effective model admits, for the finding message. */
  admits: string;
  /** The element whose model rejected the child — the parent, or a transparent chain's opaque ancestor. */
  modelTag: string;
}

/** Split a selector list on top-level commas (brackets and parens nest). */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/**
 * The `a`/`button` interactive exclusions are `a11y/interactive-nesting`'s territory (measured:
 * 16 findings stay single-reported), so these exact tokens are dropped from `:not`/`:has`
 * argument lists before evaluation. Token-exact: `audio`'s and `label`'s own exclusions survive.
 */
const INTERACTIVE_ARM_TOKENS = new Set([':model(interactive)', 'a', '[tabindex]']);

function stripInteractiveArms(parts: string[]): string[] {
  return parts.filter((p) => {
    if (INTERACTIVE_ARM_TOKENS.has(p)) return false;
    const has = /^:has\((.*)\)$/.exec(p);
    if (has) return stripInteractiveArms(splitTop(has[1]!)).length > 0;
    return true;
  });
}

class Evaluator {
  constructor(
    private readonly els: readonly ElementFact[],
    private readonly children: ReadonlyMap<number, readonly number[]>
  ) {}

  private attr(idx: number, name: string): { present: boolean; value?: string } | 'unknown' {
    const el = this.els[idx]!;
    if (el.hasSpread) return 'unknown';
    const a = el.attrs.find((x) => x.name === name);
    if (!a) return { present: false };
    return { present: true, ...(a.value !== undefined ? { value: a.value } : {}) };
  }

  private matchAttr(inner: string, idx: number): Tri {
    const m = /^([a-zA-Z-]+)(?:\s*=\s*'?([^'\s]*)'?(?:\s+i)?)?$/.exec(inner.trim());
    if (!m) return 'unknown';
    const got = this.attr(idx, m[1]!.toLowerCase());
    if (got === 'unknown') return 'unknown';
    if (!got.present) return false;
    if (m[2] === undefined) return true;
    if (got.value === undefined) return 'unknown'; // dynamic value
    return got.value.toLowerCase() === m[2].toLowerCase();
  }

  private matchCategory(cat: string, idx: number): Tri {
    // '#custom' names autonomous custom elements; a judged child is never one (dash tags are
    // skipped before judging), so the entry never matches rather than poisoning the category.
    if (cat === '#custom') return false;
    const list = HTML_SPEC.contentModels[cat];
    if (!list) return 'unknown';
    let unknown = false;
    for (const sel of list) {
      if (sel === '#text') continue;
      const r = this.matchSelector(sel, idx);
      if (r === true) return true;
      if (r === 'unknown') unknown = true;
    }
    return unknown ? 'unknown' : false;
  }

  /** Does the element's subtree contain a match for any of `sels`? Chain breaks bound the subtree. */
  private matchHas(sels: string[], idx: number): Tri {
    let unknown: Tri = this.els[idx]!.unknownContent ? 'unknown' : false;
    const stack = [...(this.children.get(idx) ?? [])];
    while (stack.length > 0) {
      const c = stack.pop()!;
      for (const sel of sels) {
        const r = this.matchSelector(sel, c);
        if (r === true) return true;
        if (r === 'unknown') unknown = 'unknown';
      }
      if (this.els[c]!.unknownContent) unknown = 'unknown';
      stack.push(...(this.children.get(c) ?? []));
    }
    return unknown;
  }

  matchSelector(sel: string, idx: number): Tri {
    sel = sel.trim();
    const el = this.els[idx]!;
    if (sel === '*') return true;
    if (sel === '#text') return false;
    if (sel.startsWith('#')) return this.matchCategory(sel, idx);
    const tm = /^[a-zA-Z][a-zA-Z0-9|-]*/.exec(sel);
    const tag = tm?.[0];
    if (tag !== undefined) {
      if (tag.includes('|')) {
        // 'svg|svg' names the HTML-embeddable <svg> root; other svg|* entries name
        // SVG-namespace children, which the rule never judges (inSvg skip).
        if (tag !== 'svg|svg' || el.tag !== 'svg') return false;
      } else if (tag !== el.tag) return false;
    }
    let rest = sel.slice(tag?.length ?? 0);
    if (tag === undefined && rest === '') return 'unknown';
    let unknown = false;
    while (rest !== '') {
      if (rest.startsWith('[')) {
        const end = rest.indexOf(']');
        if (end === -1) return 'unknown';
        const r = this.matchAttr(rest.slice(1, end), idx);
        rest = rest.slice(end + 1);
        if (r === false) return false;
        if (r === 'unknown') unknown = true;
      } else if (rest.startsWith(':')) {
        const open = rest.indexOf('(');
        if (open === -1) return 'unknown';
        const fn = rest.slice(1, open);
        let depth = 1;
        let i = open + 1;
        for (; i < rest.length && depth > 0; i++) {
          if (rest[i] === '(') depth++;
          else if (rest[i] === ')') depth--;
        }
        const arg = rest.slice(open + 1, i - 1);
        rest = rest.slice(i);
        if (fn === 'model') {
          const r = this.matchCategory('#' + arg, idx);
          if (r === false) return false;
          if (r === 'unknown') unknown = true;
        } else if (fn === 'not') {
          let any = false;
          let unk = false;
          for (const part of stripInteractiveArms(splitTop(arg))) {
            const r = this.matchSelector(part, idx);
            if (r === true) {
              any = true;
              break;
            }
            if (r === 'unknown') unk = true;
          }
          if (any) return false;
          if (unk) unknown = true;
        } else if (fn === 'has') {
          const parts = stripInteractiveArms(splitTop(arg));
          if (parts.length > 0) {
            const r = this.matchHas(parts, idx);
            if (r === false) return false;
            if (r === 'unknown') unknown = true;
          }
        } else return 'unknown';
      } else return 'unknown';
    }
    return unknown ? 'unknown' : true;
  }
}

/** Flatten the sequence grammar into its entry-selector union; `transparent` filters split out. */
function flatten(contents: unknown, acc: string[], filters: string[]): void {
  if (Array.isArray(contents)) {
    for (const c of contents) flatten(c, acc, filters);
    return;
  }
  if (typeof contents === 'string') {
    acc.push(contents);
    return;
  }
  if (contents !== null && typeof contents === 'object') {
    const o = contents as Record<string, unknown>;
    if (typeof o['transparent'] === 'string') filters.push(o['transparent']);
    for (const k of ['require', 'optional', 'oneOrMore', 'zeroOrMore', 'choice']) {
      if (k in o) flatten(o[k], acc, filters);
    }
  }
}

/** No category entry besides script-supporting — the closed containers of the severity split. */
function isClosedEntrySet(entries: readonly string[]): boolean {
  return entries.every(
    (e) => (!e.startsWith('#') && !e.includes(':model(')) || /^(?:#|:model\()script-supporting\)?$/.test(e)
  );
}

/** Human description of the effective entry set, for the finding message. */
function describeEntries(entries: readonly string[], modelTag: string): string {
  const tags = [
    ...new Set(entries.filter((e) => /^[a-zA-Z]/.test(e) && !e.includes('|')).map((e) => /^[a-zA-Z0-9-]+/.exec(e)![0]))
  ];
  if (isClosedEntrySet(entries)) {
    const hasScript = entries.some((e) => e.includes('script-supporting'));
    if (tags.length === 0) return `\`<${modelTag}>\` admits no element children`;
    const list = tags.map((t) => `\`<${t}>\``).join(', ');
    return `\`<${modelTag}>\` admits only ${list}${hasScript ? ' and script-supporting elements' : ''}`;
  }
  const cat = entries
    .map((e) => /(?:^#|:model\()([a-zA-Z-]+)/.exec(e)?.[1])
    .find((c) => c !== undefined && c !== 'script-supporting');
  return cat !== undefined
    ? `\`<${modelTag}>\`'s content model is ${cat} content`
    : `it is outside \`<${modelTag}>\`'s content model`;
}

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** Tags that only mean anything inside their specific container — a violation with one as the child breaks structure wherever it lands. */
const STRUCTURE_BOUND = new Set([
  'li',
  'dt',
  'dd',
  'tr',
  'td',
  'th',
  'thead',
  'tbody',
  'tfoot',
  'caption',
  'col',
  'colgroup',
  'optgroup',
  'figcaption',
  'legend',
  'summary',
  'source',
  'track'
]);

/**
 * Judge one literal child against its literal parent chain. `ancestors` is the parent-link chain,
 * outermost first, ending at the direct parent; `children` maps element index → child indexes
 * (both derived from `ElementFact.parent`). Returns a violation, or undefined (permitted /
 * unknowable — every unknown resolves toward silence).
 */
export function judgeContent(
  els: readonly ElementFact[],
  children: ReadonlyMap<number, readonly number[]>,
  ancestors: readonly number[],
  childIdx: number
): ContentJudgment | undefined {
  const ev = new Evaluator(els, children);
  const child = els[childIdx]!;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const holder = els[ancestors[i]!]!;
    const spec = HTML_SPEC.elements[holder.tag];
    if (!spec?.contentModel) return undefined;
    const cm = spec.contentModel as { contents?: unknown; conditional?: { condition: string; contents: unknown }[] };
    if (cm.contents === true) return undefined;
    const violation = (entries: readonly string[]): ContentJudgment => ({
      verdict: 'violation',
      closedModel:
        isClosedEntrySet(entries) ||
        HEADINGS.has(child.tag) ||
        HEADINGS.has(holder.tag) ||
        STRUCTURE_BOUND.has(child.tag),
      admits: describeEntries(entries, holder.tag),
      modelTag: holder.tag
    });
    if (cm.contents === false) return violation([]);
    let entries: string[] = [];
    const filters: string[] = [];
    flatten(cm.contents, entries, filters);
    // A transparent filter binds regardless of the ancestor model (interactive arms stripped).
    for (const f of filters) {
      const r = ev.matchSelector(f, childIdx);
      if (r === false) return violation(entries);
      if (r === 'unknown') return undefined;
    }
    if (cm.conditional) {
      const grandparent = i >= 1 ? els[ancestors[i - 1]!] : undefined;
      for (const cond of cm.conditional) {
        const applies = conditionApplies(ev, cond.condition, ancestors[i]!, holder, grandparent?.tag);
        if (applies === true) {
          // A decidable conditional replaces the base model; first match wins.
          if (cond.contents === true) return undefined;
          const repl: string[] = [];
          const rf: string[] = [];
          flatten(cond.contents === false ? [] : cond.contents, repl, rf);
          for (const f of rf) {
            const r = ev.matchSelector(f, childIdx);
            if (r === false) return violation(repl);
            if (r === 'unknown') return undefined;
          }
          entries = repl;
          break;
        }
        if (applies === 'unknown') {
          // Undecidable: the laxest reading — the union of every branch.
          if (cond.contents === true) return undefined;
          if (cond.contents !== false) flatten(cond.contents, entries, filters);
        }
      }
    }
    let unknown = false;
    for (const e of entries) {
      if (e === '#text') continue;
      const r = ev.matchSelector(e, childIdx);
      if (r === true) return undefined;
      if (r === 'unknown') unknown = true;
    }
    if (unknown) return undefined;
    // Pure transparent (or transparent alongside own entries): the ancestor's model decides.
    if (filters.length > 0) {
      if (i > 0) continue;
      return undefined;
    }
    return violation(entries);
  }
  return undefined;
}

/** Decide a `conditional` arm's condition against the holder element (and its literal parent). */
function conditionApplies(
  ev: Evaluator,
  condition: string,
  holderIdx: number,
  holder: ElementFact,
  grandparentTag: string | undefined
): Tri {
  const ancestorForm = /^([a-z]+) > (\[.*\]|[a-z]*(?:\[.*\])?)$/.exec(condition);
  if (ancestorForm) {
    const [, anc, selfSel] = ancestorForm;
    const self =
      selfSel === '' || selfSel === holder.tag
        ? true
        : ev.matchSelector(selfSel!.startsWith('[') ? holder.tag + selfSel! : selfSel!, holderIdx);
    if (self === false) return false;
    if (grandparentTag === undefined) return 'unknown';
    if (grandparentTag !== anc) return false;
    return self;
  }
  if (condition.startsWith('[')) return ev.matchSelector(holder.tag + condition, holderIdx);
  if (/^[a-z-]+$/.test(condition)) return ev.matchSelector(`${holder.tag}[${condition}]`, holderIdx);
  if (/^[a-z]+\[/.test(condition)) return ev.matchSelector(condition, holderIdx);
  return 'unknown';
}
