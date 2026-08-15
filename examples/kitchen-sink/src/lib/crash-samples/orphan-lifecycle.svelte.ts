// glob-collected, never imported — importing this crashes the client: onMount
// called at module scope runs outside any component's initialisation and throws
// Svelte's lifecycle_outside_component error.
import { onMount } from 'svelte';

onMount(() => {
  console.log('mounted'); // correctness/orphan-lifecycle
});
