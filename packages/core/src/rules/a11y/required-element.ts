import type { Result } from '../../types.js';
import type { Rule, RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';
import { compileOverrides } from '../../config-apply.js';
import { isMentionedAnywhere, listOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';
import { resultFactory } from './route-rule.js';
import { ELEMENTS_OPTION } from './element-declarations.js';

const ID = 'a11y/required-element';
const OPTIONS: RuleOptionsSpec = { elements: ELEMENTS_OPTION };
const recommendation =
  'Add the element to the route — usually in the layout the route composes — or narrow the declaration with an `overrides` entry for the routes it does not apply to.';
const result = resultFactory(ID, recommendation, 'warning');

/**
 * a11y/required-element — every route must contain the elements the project declares (design
 * 2026-08-19-config-driven-element-rules). Judged on the composed route: the layout chain, the page,
 * every resolved component and the shell's `<body>`, because "`<main>` on every route" is a claim
 * about the page the user sees, and a `+page.svelte` alone rarely holds it.
 *
 * Presence is open-world: an unresolved component can only add elements, so a route with every
 * declared tag present passes however closed the world is. Absence needs the closed world for
 * elements (`elementsClosed`), which spreads and expression ids do not disturb; a route missing a
 * declared tag with the world open emits nothing.
 */
export const a11yRequiredElement: Rule = {
  id: ID,
  title: 'Required element',
  category: 'a11y',
  severity: 'warning',
  scope: 'route',
  passLabel: 'Required elements present',
  rationale:
    'A project can decide that every page must carry certain elements — a `<main>` landmark, an `<h1>`, a `<nav>` — and this rule reports a route that composes without one. It has no opinion of its own: with nothing declared it does nothing. Presence is judged across the whole composed route, so an element supplied by a layout, a resolved component or `app.html` counts.',
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    if (!isMentionedAnywhere(ctx.config, ID)) return [];
    const compiled = compileOverrides(ctx.config);
    const out: Result[] = [];
    for (const route of ctx.a11y ?? []) {
      // A provider that collects no presence set (or no file to anchor to) has nothing to judge.
      if (route.elementTags === undefined || route.file === undefined) continue;
      const o = resolveRuleOptions(ID, OPTIONS, ctx.config, { route: route.route, file: route.file }, compiled);
      const declared = [...new Set(listOption(o, 'elements').map((t) => t.toLowerCase()))];
      if (declared.length === 0) continue;
      const present = new Set(route.elementTags);
      const missing = declared.filter((t) => !present.has(t));
      const occ = { file: route.file, line: 0 };
      if (missing.length === 0) {
        out.push(result(route.route, PASS, occ, 'Required elements present'));
        continue;
      }
      // "Missing" is a closed-world claim; with the world open the route is simply not judged.
      if (route.elementsClosed !== true) continue;
      for (const tag of missing) {
        out.push(
          result(
            route.route,
            PENALIZED,
            occ,
            `<${tag}> is required on every route by this project's configuration and this route has none`
          )
        );
      }
    }
    return out;
  }
};
