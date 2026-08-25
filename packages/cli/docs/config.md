---
title: The config file
description: Where svelte-vitals.config lives, every top-level option, how to disable or re-grade a rule, and how to scope rules to routes or files.
---

# The config file

## Where it lives

In the **analyzed directory only** — no upward search. First match wins:

1. `svelte-vitals.config.js`
2. `svelte-vitals.config.ts`

No file means built-in defaults. `svelte-vitals install --client config-file` scaffolds one with
every option commented out.

`--config <path>` analyzes under the config file at that path instead of the one in the analyzed
directory — no discovery, no merge. A relative path resolves against the directory you run the
command from, never the analyzed directory: from a repo root,
`svelte-vitals apps/web --config shared/sv.config.js` reads `./shared/sv.config.js`. It accepts
`.js` and `.ts` only, and a missing or unreadable file exits `2`. Useful for trying a config out
before committing it, and for sharing one config across the apps in a monorepo. CLI only: the Vite
plugin resolves its own config from the `cwd` passed to `svelteVitals({ ... })` (else the Vite
config root) — share with it by importing the shared file in `vite.config.ts` and spreading it
into the plugin's options.

```js
// svelte-vitals.config.js
export default {
  treatDynamicAs: 'warn',
  metaComponents: ['Seo'],
  rules: { 'seo/json-ld': 'off' },
  failOn: 'warning',
  weights: { seo: 2 }
};
```

A `.ts` config can `import { defineConfig } from 'svelte-vitals'` for type-checking, but that is a
**runtime** import: it needs svelte-vitals as a declared dependency. A plain `export default {}`
in `.js` behaves identically and needs no dependency. Both are ESM — the project must be
`"type": "module"` (SvelteKit's default).

## Options

| Option           | Type                                                           | Default            |
| ---------------- | -------------------------------------------------------------- | ------------------ |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'`                                   | `'pass'`           |
| `metaComponents` | `string[]`                                                     | `[]`               |
| `rules`          | `Record<ruleId, 'off' \| Severity \| { severity?, options? }>` | `{}`               |
| `failOn`         | `'critical' \| 'warning' \| 'info'`                            | `'critical'`       |
| `weights`        | `Partial<Record<Category, number>>`                            | every category `1` |
| `overrides`      | `RuleOverride[]`                                               | (none)             |

`Severity` is `'critical' | 'warning' | 'info'`. `Category` is `'seo' | 'performance' |
'correctness' | 'security' | 'architecture' | 'a11y'`. A weight of `0` drops a category from the Health
average; setting every category to `0` is an error (exit `2`).

`metaComponents` names head-metadata components the analyzer cannot resolve (e.g. from an npm
package without an adapter). Components the analyzer can resolve in your own repo are followed
automatically — declaring one of those is a no-op; the declaration only kicks in when
resolution fails.

## Turning a rule off or down

```js
export default {
  rules: {
    'seo/json-ld': 'off', // remove its findings entirely
    'architecture/prop-count': 'info' // keep it, stop it failing the build
  }
};
```

Many rules take options, so check whether the finding is a **threshold disagreement** rather than
a defect first. `svelte-vitals explain <rule-id>` prints each option's name, default, bounds, and
merge semantics (`integer` replaces, `string-list` appends, `string-map` is spread over).

```js
export default {
  rules: {
    'architecture/prop-count': { options: { max: 12 } }
  }
};
```

## Scoping to routes or files (`overrides`)

`rules` applies everywhere; `overrides` applies only where it matches — typically routes that
are deliberately not public.

```js
export default {
  overrides: [
    { files: 'src/routes/(app)/**', rules: { seo: 'off' } },
    { route: '/admin/**', rules: { 'seo/title-presence': 'info' } }
  ]
};
```

Each entry needs `rules` (keys are rule ids **or** category names) plus at least one of:

- **`route`** — glob(s) against the route id as reported (`/blog/[slug]`). SvelteKit `(group)`
  segments are **not** in the route id, so use `files` to target a group.
- **`files`** — glob(s) against the source path.

Globs are deliberately small: `*` within a segment, `**` across segments, a trailing `/**` also
matches the bare prefix. Everything else — including `(`, `)`, `[`, `]` — is literal. Later entries win.

## Precedence

Per field: **CLI flag > config file > built-in default**. One exception — `--rules` and `--ignore`
are selection, not configuration: `--rules` narrows the run to the ids it names and overrides a
config-file `off` for them, but keeps their declared severity and options; `--ignore` adds `off`
entries for the ids it names, layered on top of whatever `rules` resolved to, and beats `--rules`
when both name the same rule.

`overrides` has no CLI flag; route policy belongs in a committed file.

## Validation

An unknown rule id or category, a negative weight, a malformed `overrides` entry, or an invalid
rule setting is a **hard error (exit `2`)** — a typo must not silently un-gate CI. An unrecognized
`treatDynamicAs`/`failOn` value, or an unknown top-level key, only warns.

## Related

- `svelte-vitals explain --list` — every rule id
- `svelte-vitals docs show scoping` — accepting an existing backlog instead of disabling rules
