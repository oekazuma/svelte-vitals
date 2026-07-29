/**
 * The casing vocabulary and the SvelteKit route-segment decoder used by
 * `architecture/directory-naming` (design 2026-07-29).
 *
 * Each pattern tests the WHOLE name rather than its first character. That is what lets a project
 * distinguish `recommend-halls` from `recommendHalls`; a first-character test — which is what
 * `architecture/unit-entry-file` uses for its own, different question — cannot. The two rules mean
 * different things by "PascalCase" on purpose, and each rule page says which.
 */
export const CASINGS: Record<string, RegExp> = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  'kebab-case': /^[a-z0-9]+(-[a-z0-9]+)*$/,
  snake_case: /^[a-z0-9]+(_[a-z0-9]+)*$/
};

/**
 * Split an option value into the casing names this rule knows and the ones it does not.
 *
 * `validateRuleOptions` checks only that a `string-map` value is a non-empty string — it has no
 * notion of a closed vocabulary — so a mistyped name has to be caught here and reported. A value
 * naming NO known casing is dropped from matching entirely by the caller, so a dead declaration
 * cannot shadow a live one; a value naming some is operative under those.
 */
export function parseCasings(value: string): { known: string[]; unknown: string[] } {
  const known: string[] = [];
  const unknown: string[] = [];
  for (const raw of value.split('|')) {
    const name = raw.trim();
    if (name.length === 0) continue;
    // `Object.hasOwn`, not `in` and not a `!== undefined` presence test: both of those walk the
    // prototype chain, so a value of 'toString' or 'constructor' would be taken for a known casing
    // and then blow up in `satisfiesCasing`, where the looked-up member has no `.test`. The value
    // parsed here comes from user configuration, where the whole point is that an unrecognised
    // name is reported rather than fatal.
    if (Object.hasOwn(CASINGS, name)) known.push(name);
    else unknown.push(name);
  }
  return { known, unknown };
}

/**
 * The identifier inside a SvelteKit route-syntax directory name, or `undefined` when the name does
 * not carry exactly one.
 *
 * Checking `[hallId=integer]` literally against a casing would make any declaration reaching into
 * `src/routes/` unusable, so the name is decoded first. The doubled-bracket form has to be
 * recognised before the single-bracket one, or `[[optional]]` decodes to `[optional]` and is thrown
 * away by the final test.
 *
 * That final test is what handles the compound segments SvelteKit allows: `[foo]-[bar]` decodes to
 * `foo]-[bar` and `x[y]z` to itself, both keep a bracket, and neither names one identifier a casing
 * claim could honestly be made about.
 *
 * Decoding keys off the shape of the name alone and is not restricted to `src/routes/`. A directory
 * named `[foo]` outside the routes tree does not occur in practice, so restricting it would add a
 * condition that prevents nothing.
 */
export function decodeSegment(name: string): string | undefined {
  let inner = name;
  if (inner.length > 2 && inner.startsWith('(') && inner.endsWith(')')) inner = inner.slice(1, -1);
  else if (inner.length > 4 && inner.startsWith('[[') && inner.endsWith(']]')) inner = inner.slice(2, -2);
  else if (inner.length > 2 && inner.startsWith('[') && inner.endsWith(']')) inner = inner.slice(1, -1);
  if (inner.startsWith('...')) inner = inner.slice(3);
  const eq = inner.indexOf('=');
  if (eq !== -1) inner = inner.slice(0, eq);
  if (inner.length === 0 || /[[\]()]/.test(inner)) return undefined;
  return inner;
}

/**
 * Whether `name` satisfies any one of `allowed`.
 *
 * A name with no ASCII letter in it satisfies everything. `2024`, `404` and `123` carry no casing at
 * all, so there is no casing claim to make — the same reason a compound route segment is skipped.
 * The patterns alone would not do this: they require a leading letter, so `2024` would fail
 * `camelCase` and a year-archive route would be reported for a name the project cannot change
 * without changing its URL. The line is "contains no letter", not "starts with a digit":
 * `2024archive` does contain letters, is camelCase by no reading, and can be renamed.
 */
export function satisfiesCasing(name: string, allowed: string[]): boolean {
  if (!/[a-zA-Z]/.test(name)) return true;
  return allowed.some((c) => Object.hasOwn(CASINGS, c) && CASINGS[c]!.test(name));
}
