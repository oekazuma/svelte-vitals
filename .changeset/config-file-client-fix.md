---
'svelte-vitals': patch
---

Fix `svelte-vitals install --client config-file`, which was rejected with "unknown --client 'config-file'" despite being documented in `--help` and `svelte-vitals install --help` — the CLI argument parser's list of valid `--client` ids never included the config-file target.
