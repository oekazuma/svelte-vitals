// glob-collected, never imported — importing this crashes the client: a top-level
// $effect in a runes module runs at import time, outside any component's
// initialisation, and throws Svelte's effect_orphan error.
export let pollCount = $state(0);

$effect(() => {
  pollCount += 1; // correctness/orphan-effect
});
