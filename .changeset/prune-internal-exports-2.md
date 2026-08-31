---
'@svelte-vitals/core': patch
---

Remove 19 values (`resolveRole`, `LANDMARK_ROLES`, `emptyComponentFacts`, `emptyKitModuleFacts`, `parseKitModuleFacts`, `resolveRunesModuleSpecifier`, the `findKitPathsBase*`/`findKitAliases*` helpers, `imageRule`, `linkRule`, `scoreBand`, `scoresByCategory`, `overrideMatches`, `isMentionedAnywhere`, `validateRuleOptions`, `intOption`, `listOption`, `mapOption`) and 3 types (`HeadProvider`, `ViteKitConfigResult`, `RawKitAliases`) from the `./internal` entry — no consumer imported them. Each stays exported from its source module for in-core use. `./internal` carries no semver guarantee.
