---
'@svelte-vitals/core': minor
---

Remove 20 values (`resolveRole`, `headTagRule`, `LANDMARK_ROLES`, `emptyComponentFacts`, `emptyKitModuleFacts`, `parseKitModuleFacts`, `resolveRunesModuleSpecifier`, the `findKitPathsBase*`/`findKitAliases*` helpers, `imageRule`, `linkRule`, `scoreBand`, `scoresByCategory`, `overrideMatches`, `isMentionedAnywhere`, `validateRuleOptions`, `intOption`, `listOption`, `mapOption`) and 3 types (`HeadProvider`, `ViteKitConfigResult`, `RawKitAliases`) from the `./internal` entry — no consumer imported them. Each stays exported from its source module for in-core use. `./internal` carries no semver guarantee, but the removals ship as a core minor so an already-installed plugin built against the old surface surfaces as a peer-dependency conflict at install time (a warning or resolution failure, depending on the package manager) instead of failing at import.
