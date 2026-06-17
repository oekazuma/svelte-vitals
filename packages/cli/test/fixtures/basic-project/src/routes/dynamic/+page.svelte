<script>
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.title}</title>
</svelte:head>

<h1>{data.title}</h1>
