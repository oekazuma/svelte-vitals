import { componentRule } from '../component-rule.js';
import { isKnownAriaAttribute } from './aria-data.js';
import { roleCandidates, roleRow } from './role-candidates.js';

const NAMING = new Set(['aria-label', 'aria-labelledby', 'aria-braillelabel']);

/**
 * (role, property) pairs the vendored table says the role does not own but aria-query — and so the
 * Svelte compiler — still lists as supported. Warning here would be a different verdict on the same
 * markup, which "the compiler wins" forbids whichever source is more current (only `listitem`/
 * `aria-level` and `listbox`/`aria-expanded` are ARIA 1.2-supported; the rest are 1.1 leftovers or
 * superclass artefacts). Pinned by test; the diff is exactly these ten.
 */
export const COMPILER_ACCEPTS = new Set([
  'listitem aria-level',
  'tablist aria-level',
  'listbox aria-expanded',
  'menuitemcheckbox aria-readonly',
  'menuitemcheckbox aria-required',
  'menuitemradio aria-readonly',
  'menuitemradio aria-required',
  'graphics-document aria-expanded',
  'graphics-object aria-expanded',
  'graphics-symbol aria-expanded'
]);

export const a11yDisallowedAriaProps = componentRule({
  id: 'a11y/disallowed-aria-props',
  title: 'ARIA attribute not allowed on this role',
  category: 'a11y',
  severity: 'warning',
  label: 'ARIA attributes match their role',
  rationale:
    "An `aria-*` attribute the element's role does not support is ignored by assistive technology, and one the role prohibits — a name on a `generic` `<div>` or `<span>`, on a `<p>`, on `<label>` — is worse than ignored: it is a name the author believes is exposed and is not. Judged against the ARIA 1.3 role tables, on the explicit role when there is one and otherwise on every implicit role the element can have.",
  recommendation:
    'Give the element a role that supports the attribute (`role="group"`, `role="region"`, `role="img"`), move the attribute to the element that owns the semantics, or drop it.',
  applies: (c) => (c.ariaElements ?? []).some((e) => e.aria.length > 0),
  bad: (c) =>
    (c.ariaElements ?? []).flatMap((e) => {
      const cand = roleCandidates(e);
      if (!cand) return [];
      const rows = cand.roles.map(roleRow);
      // "No corresponding role" or a role with no table row (DPUB-ARIA) leaves ownership unknown.
      const ownershipKnown = rows.every((r) => r !== undefined);
      // Every finding is anchored at the element's start tag (`e.line`), not the attribute's line: a
      // `disable-next-line` directive can only sit above the tag, so an attribute-line anchor on a
      // multi-line element would leave the documented lever with no position that works.
      return e.aria.flatMap((a) => {
        if (!isKnownAriaAttribute(a.name)) return [];
        // Form (a): a naming attribute on an element whose role does not take a name.
        if (NAMING.has(a.name) && cand.namingProhibited) {
          return [
            { line: e.line, message: `\`${a.name}\` is prohibited on <${e.tag}> — its role does not take a name` }
          ];
        }
        if (!ownershipKnown) return [];
        // Form (b): prohibited by every candidate role's row.
        if (rows.every((r) => r!.prohibitedProperties.includes(a.name))) {
          const role = cand.roles.join('/');
          return [{ line: e.line, message: `\`${a.name}\` is prohibited on role \`${role}\`` }];
        }
        // Not owned by any candidate role, and not a pair the compiler accepts.
        if (rows.every((r) => !r!.ownedProperties.some((p) => p.name === a.name))) {
          if (cand.roles.some((r) => COMPILER_ACCEPTS.has(`${r} ${a.name}`))) return [];
          const role = cand.roles.join('/');
          return [{ line: e.line, message: `\`${a.name}\` is not supported by role \`${role}\`` }];
        }
        return [];
      });
    })
});
