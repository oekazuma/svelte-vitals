# Inline suppression directive — `svelte-vitals-disable-next-line`

**Date:** 2026-07-04
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (type + filter), `svelte-vitals` (CLI capture), `@svelte-vitals/mcp` (surfaces automatically via `allRules`)
**Issue:** [#92](https://github.com/oekazuma/svelte-vitals/issues/92)

## Goal

CORRECT002 ("`$effect` only assigns state — use `$derived` instead") false-positives
on the intentional "mount signal" pattern:

```svelte
<script>
  // eslint-disable-next-line svelte/prefer-writable-derived
  let mounted = $state(false);
  $effect(() => {
    mounted = true;
  });
  const showVibrationToggle = $derived(mounted && canVibrate());
</script>
```

Here `$derived(canVibrate())` would run during hydration and reintroduce the
mismatch the `$effect` exists to avoid — the analyzer cannot infer that distinction
statically. Rather than add narrow heuristics for this one shape (issue #92's
options 1/2), add a general-purpose escape hatch (option 3): an inline comment,
`// svelte-vitals-disable-next-line CORRECT002`, that suppresses a specific
rule's finding on the following line. This also covers analogous false positives
in other component-scoped rules (CORRECT001/003/004, SEC001/002, ARCH001/002,
PERF009/010) without any per-rule work.

Out of scope: fixing the `svelte-meta-tags` detection gaps in #91 — unrelated
detection logic, not a suppression need.

## Background / current state

- Component-scoped rules (Correctness/Security/Architecture/some Bundle rules)
  are built via `componentRule()` (`packages/core/src/rules/component-rule.ts`),
  which iterates `ctx.components: ComponentFacts[]` — one entry per `.svelte` file,
  produced by `parseComponentFacts()` (`packages/cli/src/providers/source/parse.ts`)
  and collected by `collectComponentFacts()` (`packages/cli/src/providers/source/components.ts`).
- `componentRule()` calls `opts.applies(c)` then `opts.bad(c)` (a `{ line, message }[]`);
  if empty it emits one PASS `Result`, otherwise one PENALIZED `Result` per bad item.
- There is no existing inline-suppression mechanism anywhere in the codebase.
  The only existing silencing mechanism is whole-rule, whole-run: `--ignore
<ids>` / `--rules <ids>` (`packages/cli/src/rules-config.ts`), which is too
  coarse for a single intentional occurrence.
- Every component-rule fact already carries a 1-based source `line` (each block's
  opening tag, the `$effect(` call, the `{@html}` tag, the flagged attribute, …),
  which is exactly what a "disable next line" directive needs to match against.

## Design

### 1. Directive syntax

Two forms, symmetric across script and template:

```js
// svelte-vitals-disable-next-line CORRECT002
// svelte-vitals-disable-next-line CORRECT002, SEC001   // multiple ids, comma-separated
// svelte-vitals-disable-next-line                      // no id = suppress every rule on the next line
```

```html
<!-- svelte-vitals-disable-next-line CORRECT001 -->
<!-- svelte-vitals-disable-next-line -->
```

**Matching rules (strict — avoid false suppressions):**

- The directive must be the **entire content of its line** (leading whitespace
  allowed). A trailing same-line comment (`let x = 1; // svelte-vitals-disable-next-line CORRECT002`)
  is **not** recognized in v1 — no `disable-line` variant for now (YAGNI; can be
  added later if requested).
- Rule ids match `/^[A-Za-z]+\d+$/` (e.g. `CORRECT002`); compared case-insensitively
  and uppercased for storage.
- The suppressed line is the directive's line **+ 1** (an intervening blank line
  breaks the match — same as ESLint's `disable-next-line`).
- An unknown/misspelled rule id is not an error — it simply matches nothing.
  No "unused directive" warning in v1 (YAGNI).

### 2. Capture — `ComponentFacts.suppressions`

`packages/core/src/component.ts`:

```ts
/** An inline `svelte-vitals-disable-next-line` directive found in the component's source. */
export interface SuppressionDirective {
  /** 1-based line the directive suppresses (the line immediately after the comment). */
  line: number;
  /** Rule ids suppressed on that line; undefined = suppress every rule on that line. */
  ruleIds?: string[];
}
```

Add `suppressions: SuppressionDirective[];` to `ComponentFacts`.

`packages/cli/src/providers/source/parse.ts` — new function, pure text scan
(no AST — works uniformly for `<script>` and template):

```ts
const JS_DIRECTIVE = /^\s*\/\/\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*$/;
const HTML_DIRECTIVE =
  /^\s*<!--\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*-->\s*$/;

function collectSuppressions(source: string): SuppressionDirective[] {
  const lines = source.split('\n');
  const out: SuppressionDirective[] = [];
  lines.forEach((line, i) => {
    const m = JS_DIRECTIVE.exec(line) ?? HTML_DIRECTIVE.exec(line);
    if (!m) return;
    const ruleIds = m[1]?.split(',').map((s) => s.trim().toUpperCase());
    out.push({ line: i + 2, ruleIds });
  });
  return out;
}
```

Call it once in `parseComponentFacts()` and include `suppressions` in its return
value / return-type declaration.

`packages/cli/src/providers/source/components.ts` — add `suppressions: []` to the
catch-branch fallback `ComponentFacts` (parse failure → no facts, consistent with
the other empty-array fields).

### 3. Enforcement — `component-rule.ts`

```ts
function isSuppressed(c: ComponentFacts, ruleId: string, line: number): boolean {
  return (c.suppressions ?? []).some((s) => s.line === line && (!s.ruleIds || s.ruleIds.includes(ruleId)));
}
```

In `check()`, filter `opts.bad(c)` before the pass/fail branch:

```ts
const bad = opts.bad(c).filter((b) => !(b.line > 0 && isSuppressed(c, opts.id, b.line)));
```

(`b.line > 0` mirrors the existing "0 = unknown line" convention — a finding with
no line can't be matched to a directive, so it's never suppressible.)

No other change to `component-rule.ts`: if `bad` becomes empty (either originally,
or because every item was suppressed), the existing PASS branch fires unchanged.
This one filter point automatically covers every rule built with `componentRule()`
— CORRECT001–004, SEC001–002, ARCH001–002, PERF009–010 — with no per-rule code.

### 4. Docs

Add one section to the CLI guide, next to `--ignore` (not per-rule pages — 10
rule pages × 2 languages is out of proportion to this feature; can be linked from
individual rule pages later if it comes up):

- `docs/src/content/docs/guides/cli.md` — new `### Suppressing a single finding
inline` section after `### --ignore <ids>`: syntax, the Vibration-pattern
  example from the issue, and the two matching caveats (no same-line trailing
  form; a blank line between comment and code breaks the match).
- `docs/src/content/docs/ja/guides/cli.md` — same content in Japanese.

### 5. Changeset

`@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/mcp` — **minor** (new
capability, backward compatible; no `@svelte-vitals/vite` change since it's static
source analysis only).

## Testing

- `packages/cli/test/parse-component-facts.test.ts`: `collectSuppressions` via
  `parseComponentFacts` — single id, blanket (no id), comma-separated multiple
  ids, `<script>` `//` form, template `<!-- -->` form, a blank line between the
  directive and the target line does **not** suppress, a same-line trailing
  comment does **not** suppress.
- `packages/core/test/component-rule.test.ts` (new): unit-tests the filter in
  `componentRule()` directly against a fake `ComponentFacts` — a suppression
  matching the bad item's line + rule id removes it (and yields PASS when it was
  the only bad item); a suppression for a different rule id does not remove it;
  a blanket suppression (`ruleIds: undefined`) removes it regardless of rule id.
- `packages/core/test/correctness-rules.test.ts`: regression test using the
  issue's exact Vibration-toggle shape — CORRECT002 passes when preceded by
  `// svelte-vitals-disable-next-line CORRECT002`.
- `packages/core/test/security-rules.test.ts`: a template-side regression —
  `<!-- svelte-vitals-disable-next-line SEC001 -->` above an `{@html}` tag passes.
- Full suite + typecheck + lint + `docs build` green; no assertions loosened.

## Out of scope (YAGNI)

- `disable-line` (same-line trailing comment) variant.
- "Unused suppression directive" detection/warning.
- Any suppression mechanism for route/project-scoped rules (SEO, perf resource
  hints, etc.) — those aren't part of this issue and would need a different
  integration point (they don't all go through `componentRule()`).
- Per-rule-page documentation of the directive (10 pages × 2 languages); the CLI
  guide is the single source of truth for now.
- Fixing #91 (svelte-meta-tags detection gaps) — different problem, not a
  suppression need.
