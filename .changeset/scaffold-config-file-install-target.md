---
'svelte-vitals': minor
---

Add a `config-file` install target: `svelte-vitals install --client config-file` scaffolds `svelte-vitals.config.mjs` with every option commented out. Previously the only way to adopt a config file was to hand-write it from the docs example — `install` already generates the other four onboarding artifacts (MCP client config, Vite plugin/hooks wiring, agent skill/rules files) but left the config file out of that flow. Supports `--force` to regenerate.
