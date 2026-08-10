---
'svelte-vitals': minor
---

Shell completion: `svelte-vitals complete <bash|zsh|fish|powershell>` prints a completion script — sub-command names, every flag, and values for the enum-ish flags (`--reporter`, `--fail-on`, `--category`, `--treat-dynamic-as`). Completions are generated from the same argument declarations that drive parsing and `--help`, so they stay in sync with the CLI automatically. `complete` is a new reserved top-level token, alongside `docs`/`explain`/`install`/`ci` — it wins over a same-named directory, same as those four. No existing command, flag, or output changes, except the root `--help` Usage block, which now lists the new sub-command.
