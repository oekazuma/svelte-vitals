<script>
  import { MetaTags } from 'svelte-meta-tags';
  let { data } = $props();
</script>

<MetaTags title={data.title} description="A page" />
