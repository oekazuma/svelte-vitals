<script>
  let { children } = $props();
</script>

<svelte:head>
  <title>Blog</title>
</svelte:head>

{@render children()}
