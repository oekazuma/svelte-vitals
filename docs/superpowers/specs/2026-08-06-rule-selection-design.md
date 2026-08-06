# Flags select, the config file configures — design

**Date:** 2026-08-06
**Status:** proposed
**Origin:** a field report on 0.41.0. Following an instruction sheet that used
`--rules architecture/reserved-name-placement`, a real project got zero findings and no diagnostic from a rule
whose options it had declared — and read that as "the tree complies". `--ignore`'s half of the same defect
shipped as a patch in `fix(cli): stop --ignore from discarding a config file's per-rule options`; this design is
the other half.

## The problem

**`--rules X` discards X's own configuration, so an option-configured rule cannot be run alone from the CLI.**

Measured before the `--ignore` patch and unchanged by it: a config file declaring options for one rule, a tree
that violates it, `--rules <that rule>` → **0 findings, exit 0, no warning**. The rule ran; it ran with built-in
defaults, and the thresholds and globs the project had written were gone.

For an L3 rule — inert until a convention is declared — "built-in defaults" means **no convention at all**, so
the rule reports nothing and cannot report anything. Narrowing a CI run to a few rule ids silently swaps the
project's configuration for none.

### The root cause is one field carrying two meanings

`AnalyzeOptions.rules` has two consumers that mean different things by it:

| consumer                                                                       | value passed                                                                 | intent                          |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------- |
| the CLI's `--rules`                                                            | a synthesized map of nothing but `'off'` entries, one per rule **not** named | "enable only the named rules"   |
| `@svelte-vitals/vite`'s dashboard runner (`ui/analysis.ts` → `analyzeProject`) | the user's own complete `rules` object, written as a plugin option           | "this is my rule configuration" |

The CLI's value is **partial by construction** and expresses selection through the _absence_ of an entry. The
vite value is **complete** and expresses configuration through presence. One field, two encodings — which is
also why `--ignore` was able to wipe a config file: both flags were folded into that same synthesized map, and
whole-field replacement is right for one of them and indefensible for the other.

`2026-07-05-config-file-design.md` §3 chose whole-field replacement and gave its reason:

> Whole-field replacement for `rules` (rather than key-level merge) keeps `--rules SEO001` meaning what it means
> today — "enable only these rules" — regardless of what the file says; key-level merging would make the
> allow-list semantics of `--rules` (which works by generating `off` entries for everything unlisted) impossible
> to reason about.

**That reasoning is correct given the encoding**, and it is the encoding that has to change. The parenthetical
names the constraint: _"which works by generating `off` entries for everything unlisted"_. Selection expressed as
absence cannot survive a merge, because absence is not a value you can layer.

An earlier attempt at this ignored that and used a plain `{ ...file.rules, ...opts.rules }` merge. It broke the
documented behaviour the passage exists to protect — `--rules X` force-enabling X over a file `'off'` — measured
at 2 findings before and 0 after, and was discarded.

## The design

### The line: `off` is selection, everything else is configuration

A flag says **which** rules run. The config file says **how** they run. `'off'` is the one setting that is purely
selection, so it is the one a flag overrides; a severity or an options map is configuration and survives.

Three properties, all of which must hold together — no two of them hold under either whole-field replacement or a
plain merge:

1. **`--rules X` runs only X.** The allow-list narrows the run.
2. **`--rules X` force-enables X**, even where the config file sets it to `'off'`. Documented, and kept.
3. **`--rules X` keeps X's severity and options** from the config file. This is what is missing today.

### Separate the two meanings of `rules`

```ts
interface AnalyzeOptions {
  /** A complete replacement for the config file's `rules` map. Programmatic and plugin callers. */
  rules?: Record<string, RuleSetting>;
  /** `--rules`: run only these rule ids. Selection, not configuration. */
  allowRules?: string[];
  /** `--ignore`: silence these rule ids. Selection, not configuration. */
  ignoreRules?: string[];
}
```

`rules` regains one honest meaning — the whole map, replaced — which is what the vite plugin and any programmatic
caller already pass. The CLI stops synthesizing a map and passes its two id lists instead. `ignoreRules` already
exists and is unchanged.

### The composition, in full

A pure function, `resolveRuleSelection`, applied in this order:

```text
base = rules ?? file.rules ?? {}

if allowRules is non-empty:
  for every registered rule id NOT in allowRules      → 'off'
  for every id IN allowRules, rewrite base's entry:
      absent                        → leave absent   (built-in defaults)
      'off'                         → delete         (force-enable at defaults)
      { severity: 'off', options }  → { options }     (force-enable, keep options)
      { severity: 'off' } only      → delete          (no configuration left to keep)
      anything else                 → keep unchanged  (severity and/or options survive)

for every id in ignoreRules                            → 'off'
```

`ignoreRules` is applied last, which is what keeps **deny beating allow** — a guarantee that previously lived
inside `buildRulesConfig`'s single map and now lives in the ordering.

### The cases this pins, and why each is what it is

| input                                                      | result                 | why                                                   |
| ---------------------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| `--rules X`, file has no entry for X                       | X at built-in defaults | nothing to inherit                                    |
| `--rules X`, file `X: 'warning'`                           | `'warning'` kept       | severity is configuration                             |
| `--rules X`, file `X: 'off'`                               | entry dropped          | property 2                                            |
| `--rules X`, file `X: { severity: 'off', options: {...} }` | `{ options: {...} }`   | property 2 must not cost property 3                   |
| `--rules X`, file `X: { severity: 'off' }`                 | entry dropped          | an empty object setting says nothing; do not ship one |
| `--rules X --ignore X`                                     | X off                  | deny wins, unchanged from today                       |
| `--rules X`, file also configures Y                        | Y off                  | property 1                                            |
| `allowRules: []` or absent                                 | no narrowing           | see below                                             |

**`allowRules: []` means no narrowing, identical to absent.** The CLI already normalises an unpassed flag to
`undefined` to keep "not specified" distinguishable from "specified as empty", and `[]` reaching the function
from a programmatic caller must not disable the entire registry — the destructive reading of an empty list is
never the one a caller intends. The same holds for `ignoreRules`.

**`rules` and `allowRules` together** are not produced by the CLI, but the function defines them: `rules`
replaces the base, then `allowRules` narrows the result. No special case.

### One structural change, for a reason this branch has evidence for

`resolveRuleSelection` lives in its own module, `packages/cli/src/rule-selection.ts`, as a pure function of
`(file rules, rules, allowRules, ignoreRules)`.

The `--ignore` defect reached a release because the composition sat inside `analyzeProject`, which loads a config
file and detects a SvelteKit project before it gets there — so the only way to exercise it was a full analyze run
over a fixture, and no such test existed for the flag combinations. Every row of the table above is a unit test
against a pure function instead.

## Testing

1. **Every row of the case table**, as unit tests on `resolveRuleSelection`. These are the specification; a row
   without a test is a row that will drift.
2. **Force-enable survives**, asserted through the CLI on a fixture whose config sets a rule to `'off'`: the rule
   must fire under `--rules <it>`. This is the direction the discarded mechanism broke, so it needs an
   end-to-end guard and not only a unit test.
3. **An option-configured rule fires under `--rules`** — the defect itself, end to end: a fixture declaring
   options that make a rule report, and `--rules <it>` producing the finding.
4. **`--rules` still disables everything unnamed**, asserted on the set of rule ids that produced results rather
   than a count.
5. **`--ignore` still layers rather than replaces**, so the patch that shipped first is not undone. Assert an
   unrelated `--ignore` leaves another rule's options intact.
6. **Deny beats allow** with both flags naming the same id.
7. **Every path that reaches `analyzeProject` forwards the new option.** The `--ignore` fix had four such paths;
   a path that drops one makes the fix work in one code path and silently not in another, which is this defect's
   own shape. Assert by enumerating the call sites, not by sampling.

## What changes outside the code

- `docs/src/content/docs/guides/(setup)/configuration.mdx` and its Japanese counterpart currently say `--rules`
  replaces the config file's `rules` entirely. That becomes: `--rules` selects which rules run and overrides a
  file `'off'`, while severities and options for the rules it names are inherited from the file.
- `2026-07-05-config-file-design.md` §3 gains a correction note in the shape this repository uses (see
  `2026-07-28-architecture-charter-design.md`'s "Corrected 2026-08-06."): its reasoning was sound under the
  encoding it described, and the encoding is what this design replaces.

## Release

`svelte-vitals` **minor** — `--rules`'s observable behaviour changes and a new option is added. `@svelte-vitals/core`
and `@svelte-vitals/vite` are untouched.

## Deliberately not solved

- **`config.overrides` still turns a rule off for the paths it scopes, and no flag overrides that.** Overrides
  are a separate field applied after analysis; `--rules` has never reached into them and does not start here.
  A user who scopes a rule off under `src/legacy/**` and then runs `--rules <that rule>` still gets nothing for
  those paths. Recorded rather than fixed: making a selection flag reach into path-scoped configuration is a
  larger question than this defect.
- **The two halves of the vite dev dashboard.** `plugin.ts`'s live per-route view and the dashboard's runner both
  take `options.rules` as a whole-field replacement, and neither has an allow-list, so they agree under this
  design. They disagreed only under the discarded merge. Nothing to do; recorded so the next reader does not
  re-derive it.
- **Warning when a flag discards configuration.** Not needed once configuration is inherited rather than
  discarded. If a future flag has to discard, it should say so rather than exit 0 — the failure this design
  removes was silent, and that is what made it survive a release.
- **Category keys in the flag lists.** Top-level `config.rules` keys are validated as rule ids only
  (`findUnknownRuleIds`); category names are accepted in `overrides[].rules` alone. So the allow-list narrowing
  never meets a category key, and `--category` remains the way to select by category.
