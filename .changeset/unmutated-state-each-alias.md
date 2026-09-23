---
'@svelte-vitals/core': patch
---

`correctness/unmutated-state` no longer reports a `$state` list as never mutated when its items are edited through an `{#each}` binding, for example `{#each settings as setting}` with `bind:checked={setting.checked}` or `onclick={() => (row.role = 'owner')}`. Such a write changes the list's contents, so `const` or `$state.raw` would break the UI.
