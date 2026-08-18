import { componentRule } from '../component-rule.js';
import { HTML_SPEC } from '../../html-spec/index.js';
import { isKnownAriaAttribute } from './aria-data.js';
import { roleCandidates, roleRow } from './role-candidates.js';

export const a11yDeprecatedAria = componentRule({
  id: 'a11y/deprecated-aria',
  title: 'Deprecated ARIA role or attribute',
  category: 'a11y',
  // `info`: the role or attribute still works in current assistive technology; the finding is that
  // ARIA 1.3 no longer defines it here, so it may stop meaning anything.
  severity: 'info',
  label: 'ARIA roles and attributes are current',
  rationale:
    "ARIA 1.3 deprecates one role (`directory`), two global attributes (`aria-dropeffect`, `aria-grabbed`), and a number of attributes on particular roles — `aria-haspopup` on `checkbox`, `aria-disabled` on `generic`, and so on. Each still works today and each has been removed from the role's definition, so its meaning there is no longer guaranteed. The Svelte compiler reports the per-role cases on explicit roles as unsupported, since its ARIA data dropped them rather than flagging them; on a bare `<div>`/`<span>` it says nothing.",
  recommendation:
    'Replace `role="directory"` with `role="list"`; drop `aria-dropeffect`/`aria-grabbed`; and move a role-deprecated attribute to an element whose role still defines it, or drop it.',
  applies: (c) => (c.ariaElements ?? []).some((e) => e.role?.literal !== undefined || e.aria.length > 0),
  bad: (c) =>
    (c.ariaElements ?? []).flatMap((e) => {
      const out: { line: number; message: string }[] = [];
      const cand = roleCandidates(e);
      if (cand?.explicit) {
        const role = cand.roles[0] as string;
        if (roleRow(role)?.deprecated) out.push({ line: e.line, message: `role="${role}" is deprecated` });
      }
      for (const a of e.aria) {
        if (!isKnownAriaAttribute(a.name)) continue;
        if (HTML_SPEC.aria.deprecatedProps.includes(a.name)) {
          out.push({ line: a.line, message: `\`${a.name}\` is deprecated` });
          continue;
        }
        if (!cand) continue;
        const rows = cand.roles.map(roleRow);
        if (!rows.every((r) => r !== undefined)) continue;
        if (rows.every((r) => r!.ownedProperties.some((p) => p.name === a.name && p.deprecated))) {
          out.push({ line: a.line, message: `\`${a.name}\` is deprecated on role \`${cand.roles.join('/')}\`` });
        }
      }
      return out;
    })
});
