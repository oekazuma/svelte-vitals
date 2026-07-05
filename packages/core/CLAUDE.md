# @svelte-vitals/core constraints

This package is runtime-agnostic by design (design §8): **no `node:` imports, no I/O, no runtime-specific globals** anywhere in `src/`. All I/O is injected through the `Runtime` interface (`src/runtime.ts`). See the repo-root [AGENTS.md](../../AGENTS.md) for full conventions.
