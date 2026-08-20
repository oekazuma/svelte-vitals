import type { Rule } from '../../rule.js';
import type { ElementFact } from '../../component.js';
import { componentRule, type ComponentIssue } from '../component-rule.js';
import { judgeContent } from '../../html-spec/content-model.js';
import { HTML_SPEC } from '../../html-spec/generated.js';

const FIX = {
  description:
    'Move the child to an element its parent permits (e.g. wrap list content in <li>), or change the container to one that admits it (a <div> instead of a misused <ul>, a <span> instead of a block child inside a <button>).'
};

/** The compiler deliberately allows rich content in <option>/<optgroup>; the dataset does not. Compiler wins. */
const COMPILER_CARVEOUT = new Set(['option', 'optgroup']);

function judgeable(el: ElementFact): boolean {
  return !el.inSvg && !el.tag.includes('-') && (el.tag in HTML_SPEC.elements || `svg:${el.tag}` in HTML_SPEC.elements);
}

/**
 * Content-model membership over the literal element tree
 * (design 2026-08-20-permitted-contents-rule-design.md; measured
 * 2026-08-20-permitted-contents-measured.md). Broken structure (closed containers, headings,
 * structure-bound children) is `warning`; category mismatches are `info`.
 */
export const a11yPermittedContents: Rule = componentRule({
  id: 'a11y/permitted-contents',
  title: 'Permitted contents',
  category: 'a11y',
  severity: 'warning',
  label: 'Element nesting follows the HTML content models',
  recommendation: 'Restructure the markup so each element sits inside a parent whose content model permits it.',
  rationale:
    "An element outside its parent's permitted content — a `<div>` directly inside `<ul>`, a heading inside a `<button>` — is markup assistive technology mis-announces: list semantics break, headings lose or pollute their outline role. Judged per child against the HTML content models, membership only.",
  fix: FIX,
  applies: (c) => (c.elements ?? []).length > 0,
  bad: (c) => {
    const els = c.elements ?? [];
    const children = new Map<number, number[]>();
    for (let i = 0; i < els.length; i++) {
      const p = els[i]!.parent;
      if (p === undefined) continue;
      const list = children.get(p);
      if (list) list.push(i);
      else children.set(p, [i]);
    }
    const out: ComponentIssue[] = [];
    for (let i = 0; i < els.length; i++) {
      const child = els[i]!;
      if (child.parent === undefined || !judgeable(child) || child.tag === 'slot') continue;
      // ancestors: parent-link chain, outermost first
      const ancestors: number[] = [];
      for (let a: number | undefined = child.parent; a !== undefined; a = els[a]!.parent) ancestors.unshift(a);
      const parent = els[child.parent]!;
      if (!judgeable(parent) || COMPILER_CARVEOUT.has(parent.tag)) continue;
      const judgment = judgeContent(els, children, ancestors, i);
      if (!judgment) continue;
      out.push({
        line: child.line,
        message: `\`<${child.tag}>\` is not permitted content here — ${judgment.admits}`,
        severity: judgment.closedModel ? 'warning' : 'info'
      });
    }
    return out;
  }
});
