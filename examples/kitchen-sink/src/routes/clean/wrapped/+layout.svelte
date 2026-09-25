<!-- ErrorBoundary's failed <h1> replaces the page it wraps, so it never renders beside the page's own. -->
<script lang="ts">
  import ErrorBoundary from '$lib/clean/wrapped/ErrorBoundary.svelte';

  let { children } = $props();
</script>

<ErrorBoundary>
  {@render children()}
</ErrorBoundary>
