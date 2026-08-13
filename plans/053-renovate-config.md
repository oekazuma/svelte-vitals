# Plan 053: Fix renovate.json — group the gunshi family, gate its minors, replace the dead depType groups

## Status

- **Priority**: P1 / **Effort**: S / **Risk**: LOW (config-only; worst case is broader-than-wanted PR grouping)
- **Depends on**: none
- **Category**: deps
- **Planned at**: main `f4b33ba9`, 2026-08-12 (findings 260812-DEPS-04/05/06)

## Why this matters

(1) The five gunshi packages (`gunshi`, `@gunshi/docs`, `@gunshi/plugin-completion`, `@gunshi/plugin-i18n`, `@gunshi/plugin-suggestion`) are pinned exact at 0.37.1 and are mutually peer-locked at exact versions (`pnpm-lock.yaml`: `@gunshi/plugin-completion` requires peer `@gunshi/plugin-i18n: 0.37.1`). With no group rule, Renovate opens five independent PRs on a gunshi 0.38.0 release, each automerging on green — between merges `main` (which triggers releases) carries a mixed family that installs two copies of a plugin instead of failing. (2) The gunshi migration design doc (`docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md:55-57`) records the policy "any breaking bump treated as a design-review event, not a routine merge" — under 0.x semver the minor IS the breaking channel, yet the blanket automerge rule covers it: recorded decision, never wired up. (3) The `matchDepTypes: ["dependencies"]` / `["devDependencies"]` group rules have never matched anything — every dep in this repo is `catalog:`-managed in `pnpm-workspace.yaml`, and merged Renovate branch names (`renovate/node-html-parser-9.x`, `renovate/arethetypeswrong-cli-0.x`) prove single-dep PRs shipped while those rules were present. Dead rules mislead the next maintainer into assuming grouping exists.

## Current state

`renovate.json` (entire relevant portion, verified at `f4b33ba9`):

```json
"packageRules": [
  {
    "description": "Auto-merge everything except major updates (those need review) — CI still has to pass first. ...",
    "matchUpdateTypes": ["minor", "patch", "pin", "digest"],
    "automerge": true
  },
  {
    "description": "Published packages' engines.node is a public compatibility floor ...",
    "matchDepTypes": ["engines"],
    "matchFileNames": ["packages/*/package.json"],
    "enabled": false
  },
  {
    "groupName": "dependencies",
    "matchDepTypes": ["dependencies"]
  },
  {
    "groupName": "devDependencies",
    "matchDepTypes": ["devDependencies"]
  },
  { "groupName": "linters", "matchPackageNames": ["oxlint{/,}**", "oxfmt{/,}**", "publint{/,}**"] },
  { "groupName": "typescript", "matchPackageNames": ["typescript"] },
  { "groupName": "Svelte", "matchPackageNames": ["@sveltejs/{/,}**", "svelte{/,}**"] },
  { "groupName": "build-tools", "matchPackageNames": ["tsup{/,}**", "vite{/,}**", "vitest{/,}**"] }
]
```

Later rules win in Renovate's packageRules precedence (last-match wins per option).

## Commands you will need

| Purpose       | Command                                                                                       | Expected |
| ------------- | --------------------------------------------------------------------------------------------- | -------- |
| JSON validity | `node -e "JSON.parse(require('fs').readFileSync('renovate.json','utf8')); console.log('ok')"` | `ok`     |
| Lint          | `pnpm lint`                                                                                   | exit 0   |

(No install/build needed — this plan touches one JSON file. `pnpm lint` runs oxfmt over JSON; run `pnpm format` if it complains. If `pnpm lint` cannot run because dependencies are not installed, `pnpm install` first.)

## Scope

**In scope**: `renovate.json` only.
**Out of scope**: `pnpm-workspace.yaml` (the exact pins are deliberate policy — do not loosen), any `package.json`, the design doc.

## Git workflow

- Branch: `advisor/053-renovate-config`
- Commit: `chore: group the gunshi family in renovate and stop automerging its 0.x minors; drop the dead depType groups`
- Do NOT push or open a PR. No changeset (internal-only config).

## Steps

### Step 1: Replace the two dead depType rules

Delete the `"groupName": "dependencies"` and `"groupName": "devDependencies"` rule objects. In their place add one catalog-wide group so ungrouped catalog bumps stop arriving as ~20 single-dep PRs:

```json
{
  "groupName": "catalog",
  "matchFileNames": ["pnpm-workspace.yaml"]
}
```

### Step 2: Add the gunshi group with minors gated

Append AFTER all existing rules (so it wins precedence over both the automerge rule and the catalog group):

```json
{
  "groupName": "gunshi",
  "matchPackageNames": ["gunshi", "@gunshi/**"],
  "matchUpdateTypes": ["minor"],
  "automerge": false
},
{
  "groupName": "gunshi",
  "matchPackageNames": ["gunshi", "@gunshi/**"]
}
```

(The second entry groups ALL gunshi updates under one PR; the first additionally turns automerge off for minors — the 0.x breaking channel — implementing the design doc's "design-review event" policy. Patches stay automerged.)

### Step 3: Verify

`node -e "JSON.parse(...)"` → ok; `pnpm lint` → exit 0 (run `pnpm format` first if oxfmt reflows).

## Done criteria

- [ ] JSON parses
- [ ] `grep -c 'matchDepTypes' renovate.json` → `1` (only the engines rule remains)
- [ ] `grep -c '"gunshi"' renovate.json` → `2` (two group entries)
- [ ] `pnpm lint` exit 0
- [ ] `git status` shows only `renovate.json` modified

## STOP conditions

- `renovate.json` no longer matches the excerpt (someone edited it since `f4b33ba9`).
- You find evidence (e.g. a Renovate debug artifact in the repo) that catalog entries DO match `matchDepTypes: ["dependencies"]` — the premise would be wrong; report instead of editing.

## Maintenance notes

- Renovate's exact depType label for catalog entries was not verified against a live Renovate log (finding 260812-DEPS-I1); `matchFileNames: ["pnpm-workspace.yaml"]` sidesteps that question. If the catalog group misbehaves in practice, check the Dependency Dashboard's dep listing for the real depType.
- When gunshi 1.0 lands, the minor-gating entry should be revisited (minors stop being the breaking channel).
