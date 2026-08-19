# Known-limitation sweep — Phase D, item 12

Roadmap Phase D-12: every review-deferred minor becomes a fix or a documented limitation, so nothing
"known but unwritten" ships in 1.0. The inventory below is the roadmap's seven, the a11y validity
review's Priority-2 leftovers, and the items the Phase C reviews set aside. Each row says which it
became and where.

| item                                                                                                                | became        | where                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| empty `<select required>` flagged                                                                                   | documented    | `placeholder-label-option` page: flagged on purpose, never satisfiable as written               |
| `<aside>`/`<nav>` not landmark-mapped                                                                               | fixed earlier | `<aside>` → `complementary` per HTML-AAM (#516); `<nav>` is not in the duplicate set by APG     |
| source-mode `SECTIONING_TAGS` omitting `main`; `<header>`/`<footer>` top-level approximation                        | documented    | `duplicate-landmark`/`top-level-landmark` Mode sections now describe the per-file approximation |
| bare `aria-valuenow` / empty token list passing                                                                     | fixed         | blank number rejected earlier; empty token list rejected here (ARIA: one or more tokens)        |
| `/^P/` duration shape                                                                                               | fixed earlier | `require-datetime` anchors the duration on its character set, not `^P` alone                    |
| `handleHttpError` policy in the example                                                                             | documented    | kitchen-sink README, "Intentionally-defective surfaces"                                         |
| unguarded `readFileSync` in the build e2e                                                                           | fixed         | the e2e names the missing report and the build's stderr instead of ENOENT                       |
| validity review #21 header/footer per-file top-level approximation                                                  | documented    | as above                                                                                        |
| validity review #22 `IDREF_ATTRS` 5 of ~12                                                                          | fixed         | full ARIA idref set + HTML `list`/`headers`/`form`/`popovertarget`/`commandfor`                 |
| validity review #23 `HOST_SUPPLIED` missing `aria-expanded`/`aria-controls`                                         | fixed         | `<select>` and `<input list>` supply both (HTML-AAM)                                            |
| validity review #24 `use-list` fires on a single line                                                               | fixed         | two or more items under one parent (H48)                                                        |
| `unknown-aria-attribute`/`invalid-aria-value` attribute-line anchors (directive unreachable on multi-line elements) | fixed         | start-tag anchor, pinned end to end                                                             |
| `required-element` suppression key collapses several missing elements                                               | documented    | its Disabling section                                                                           |
| `explain` does not print a `string-list` option's grammar                                                           | fixed         | `RuleOptionInfo.pattern`                                                                        |
| `accessible-name`/`interactive-nesting` judge `<svg><a>` as HTML                                                    | documented    | `accessible-name` page (the verdict is the same one SVG guidance gives)                         |
| `ElementFact.attrs[].line` has no consumer                                                                          | kept          | the field's docstring names the future consumer                                                 |
| `disallowed-aria-props` cannot judge `<input>` non-global attributes                                                | documented    | its page, at design time                                                                        |
| `--report-unused-directives`                                                                                        | deferred      | design `2026-08-17-route-inline-suppression.md`, decision 6, with reason                        |
| C-3's config-key meta-test shipped narrower                                                                         | recorded      | that design's recurrence-prevention section                                                     |
| `no-missing-id-ref` runs on almost no route                                                                         | issue         | #533                                                                                            |
| `permitted-contents`                                                                                                | pending       | needs the content-model DSL evaluated to be measured                                            |

Item 13 — every rule page states its Mode differences and known limitations, guides carry no rule
counts, en/ja stamped, embedded CLI docs in sync — is a separate pass: 57 of 94 rule pages carry no
mode wording at all, and several say "static (CLI) analysis" for rules the Vite plugin also runs.
