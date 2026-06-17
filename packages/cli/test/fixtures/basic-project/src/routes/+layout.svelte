<script>
  let { children } = $props();
</script>

<svelte:head>
  <meta name="description" content="Site-wide description." />
</svelte:head>

{@render children()}
