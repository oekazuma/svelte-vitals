---
'svelte-vitals': minor
---

`--help` (all five surfaces: the root analyzer, `docs`, `explain`, `install`, `ci`) now renders in Japanese when the resolved locale is `ja` — POSIX first-non-empty-wins across `SVELTE_VITALS_LANG` > `LC_ALL` > `LC_MESSAGES` > `LANG` (`ja`, `ja-JP`, and `ja_JP.UTF-8` all canonicalize to `ja`; anything else, including unset, stays English). Everything else is byte-identical to today when no ja locale applies: English output, error messages, warnings, reporter output, and shell completion are all unaffected by this env, pinned by the existing help goldens and new boundary-regression tests. There is no `--lang` flag — the environment already expresses this on every terminal.
