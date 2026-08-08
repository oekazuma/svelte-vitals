---
'svelte-vitals': patch
---

Fix `--diff`/`--staged` silently dropping findings in files whose paths contain non-ASCII characters (e.g. Japanese route directories). Git's default `core.quotePath=true` octal-escapes such paths in `--name-only` output, which never matched the raw UTF-8 `Result.location`; changed-file detection now reads NUL-separated (`-z`) output instead.
