---
'svelte-vitals': patch
---

`svelte-vitals ci install` and `ci upgrade` now pin `oekazuma/svelte-vitals-action` at v0.14.0, which bundles `svelte-vitals` 0.55.5 in place of 0.55.2. Run `svelte-vitals ci upgrade` to move an existing workflow. Findings in CI can change in both directions with the newer analyzer, and a step on the default `failOn: critical` can start or stop failing; the action's v0.14.0 release notes list what moved.
