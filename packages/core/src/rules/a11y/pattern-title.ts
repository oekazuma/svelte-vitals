import type { ComponentFacts, ElementFact } from '../../component.js';
import { componentRule } from '../component-rule.js';

/** The input types the `pattern` attribute applies to, per the spec's applies-to table. */
const PATTERN_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password']);

/**
 * a11y/pattern-title — only judged where `pattern` is effective: no `type` (defaults to Text)
 * or a literal type in the applies-to set. A literal type outside it (`type="number"`) makes
 * pattern inert, so requiring a title there would be wrong; an expression type or pattern is
 * unknowable and passes. An unknown type keyword (`type="txet"`) falls back to the Text state
 * where pattern does apply — skipping it is a deliberate, conservative false negative (docs
 * Limitations). A blank literal `title=""` describes nothing and is reported; an expression
 * title counts as present, the a11y/accessible-name predicate. SVG-namespace inputs never
 * render as form controls and are skipped.
 */
function patternInputsMissingTitle(c: ComponentFacts): ElementFact[] {
  return (c.elements ?? []).filter((e) => {
    if (e.tag !== 'input' || e.inSvg || e.hasSpread) return false;
    const pattern = e.attrs.find((a) => a.name === 'pattern');
    if (pattern === undefined || pattern.value === undefined) return false;
    const type = e.attrs.find((a) => a.name === 'type');
    if (type !== undefined && (type.value === undefined || !PATTERN_TYPES.has(type.value.trim().toLowerCase()))) {
      return false;
    }
    return !e.attrs.some((a) => a.name === 'title' && (a.value === undefined || a.value.trim() !== ''));
  });
}

export const a11yPatternTitle = componentRule({
  id: 'a11y/pattern-title',
  title: 'Pattern input without a format description',
  category: 'a11y',
  severity: 'info',
  label: 'Pattern descriptions',
  rationale:
    'When an <input> has a pattern attribute, the spec says authors should include a title describing the expected format — browsers surface it in the validation error, and without it a failed submit tells the user only that the value is wrong, not what right looks like.',
  recommendation:
    'Add a title describing the expected format in plain words (e.g. "Letters, a dash, then digits"), and mirror it in visible help text — title alone is unavailable to many users.',
  fix: {
    description: 'Add a title attribute describing the expected format.',
    snippet: '<input pattern="[A-Za-z]+-[0-9]+" title="Letters, a dash, then digits" />',
    lang: 'svelte'
  },
  applies: (c) => patternInputsMissingTitle(c).length > 0,
  bad: (c) =>
    patternInputsMissingTitle(c).map((e) => ({
      line: e.line,
      message: '<input pattern> without a title — a failed match tells the user nothing about the expected format'
    }))
});
