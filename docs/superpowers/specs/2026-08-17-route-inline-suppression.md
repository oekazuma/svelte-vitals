# Inline suppression for route-scoped findings — design

Phase C-3 of `2026-08-16-v1-roadmap.md`. The a11y category design recorded this as a follow-up
rather than half-implementing it (`2026-08-14-a11y-category-design.md`, "Inline suppressions"):
`svelte-vitals-disable-next-line` is consumed by `fileRule` only, so a directive above a
route-scoped finding does nothing. Verified: it does nothing **silently** — no warning, no error.

The directive syntax is frozen surface at 1.0, so extending what it covers has to land before the
freeze.

## Why this first, among the Phase C items

It is the only place where a user does the work the tool documents and is ignored without being
told. A missed finding costs a defect; an escape hatch that silently fails costs trust, and the user
has no way to tell it from "the rule ignored my code".

## What a route-scoped finding already carries

Static mode gives every route-scoped a11y finding a real source location — measured on the
kitchen-sink gallery:

```json
{ "id": "a11y/id-duplication", "location": "src/lib/a11y/DupId.svelte", "line": 3 }
```

So the target of a directive is unambiguous: the file and line the finding already points at.
That is what makes this a wiring problem rather than a semantics problem.

## Decisions

### 1. Which findings a directive can silence

Any finding with a source `location` and a `line ≥ 1`. That is every route-scoped finding in static
mode, and none in rendered mode, where findings anchor to the route and have no line — so the rule
is "the directive silences a finding you can point at in a file", with no rule-by-rule list to
maintain.

### 2. Where the directives come from

**The route composition, not `ctx.components`.** The obvious wiring is for a route rule to look up
`ctx.components` for the file its finding names, but that breaks under `--route`: component facts
are not collected then (`collect-all.ts` skips them), while route-scoped rules still run — measured,
all four fire under `--route "gallery/a11y/**"`. A directive would work in a full run and silently
stop working in a scoped one, which is the same class of failure this change exists to remove.

The composition already reads and parses every chain file and every resolved local component. The
directives are collected there and carried on `ResolvedA11y`, so route rules need no second source
of truth and `--route` behaves like a full run.

### 3. A suppressed finding becomes a PASS, not a silence

`fileRule` filters suppressed findings **before** deciding PASS versus finding, so a file whose only
finding is suppressed reports a pass. Route rules follow that, for one reason: a suppressed finding
was checked. Making it vanish would put the route in the same bucket as a route the rule skipped —
and the category average deliberately excludes skipped routes so an unchecked route cannot report a
false 100. A suppressed route is checked and clean-by-decision; it belongs in the average.

### 4. A directive in a shared component silences that finding on every route

A component composed into twenty routes yields the same finding twenty times, at the same file and
line. One directive silences all of them. This differs from the suppressions file, whose key is
`id::route::location` and therefore per route.

That is the right default — the markup is one place, and the author is annotating the markup, not
twenty routes — but it is a real difference from the file-based mechanism and goes in the rule docs
rather than being left for someone to discover.

## Not in scope

- **Rendered mode.** No source files, no lines, nothing to attach a directive to. The rule pages
  already carry a Mode-differences block; this adds one line to it.
- **A directive that names a route.** `svelte-vitals-disable-next-line a11y/id-duplication` is
  whole-line and rule-scoped, and stays that way; per-route scoping is what the suppressions file
  and `overrides` are for.
- **`seo/single-h1` and other route-scoped rules outside a11y.** The wiring is general once the
  directives ride on the composition, but each rule's findings must be checked to actually carry a
  file and line before it is claimed. That is a follow-up, and the docs must not imply otherwise.

## Testing

1. A directive above the representative line silences the finding, and the rule reports a PASS for
   that route rather than nothing.
2. The same directive works under `--route`, which is the case the `ctx.components` wiring would
   have broken.
3. A directive naming a different rule id does not silence it.
4. A directive in a component composed into two routes silences both.
5. Rendered mode is unchanged — a directive in the source does not affect a build-mode finding.
6. The existing component-scoped behaviour is untouched.
