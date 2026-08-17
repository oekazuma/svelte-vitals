---
'@svelte-vitals/core': minor
---

Demote `a11y/require-datetime` and `a11y/doctype` to `info`, so each rule's weight matches the
evidence behind it.

**Exit-code consequences, measured per rule on an isolated fixture.** Both movements loosen a gate;
nothing tightens.

| rule                    | `--fail-on critical` (default) | `--fail-on warning` | `--fail-on info` |
| ----------------------- | ------------------------------ | ------------------- | ---------------- |
| `a11y/require-datetime` | 0 → 0                          | **1 → 0**           | 1 → 1            |
| `a11y/doctype`          | 0 → 0                          | **1 → 0**           | 1 → 1            |

A project running the default gate is unaffected. A project running `--fail-on warning` whose only
finding is one of these two goes from red to green.

**Scores move too.** `a11y::component` drops from 46 to 42 points of severity weight, so every a11y
component key is scored against a smaller denominator: measured on the repository's own example
app, the a11y category reads **83 → 87** with no change in findings. `a11y::project` drops from 5 to
1, which the floor of 25 absorbs — but a project-scope finding is an absolute deduction, so a
missing doctype now costs its category 1 point rather than 5. The widest pair is unchanged at 100,
so the floor's ordering invariant is untouched.

**Why.** Severity tracks the strength of the evidence, the standard set when the SEO severities were
aligned:

- `a11y/require-datetime`'s requirement is HTML conformance, not an accessibility criterion. A
  screen reader reads "last Tuesday" exactly as a sighted reader does; what the element loses is its
  machine-readable value.
- `a11y/doctype`'s accessibility premise has no source at all — quirks mode is documented as a
  layout difference, and the WCAG criterion that used to justify markup-validity checks is obsolete
  and removed. The layout claim stands, so the rule stands, at the weight that claim supports.
