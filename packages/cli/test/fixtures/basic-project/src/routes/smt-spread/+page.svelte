<script>
  import { MetaTags } from 'svelte-meta-tags';
  let { metaTags } = $props();
</script>

<MetaTags {...metaTags} />
