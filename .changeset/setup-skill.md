---
'svelte-vitals': minor
---

Add the `setup-svelte-vitals` agent skill, distributed alongside the other two via `npx skills add oekazuma/svelte-vitals`. Where `install` scaffolds a config file with every option commented out, this one derives the config from the project: it reads an existing markuplint or eslint-plugin-check-file config, infers the conventions a project without either already follows, measures each candidate rule with `--config` before anything is written, and decides adoption per rule. It exists mainly for the rules that ship inert — the ones that examine nothing until a project fills their options in.
