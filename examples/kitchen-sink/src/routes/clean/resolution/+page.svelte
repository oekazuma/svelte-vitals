<!-- Every head tag and the <h1> arrive through a barrel, a namespace import or a runtime-chosen component. -->
<script lang="ts">
  import { MetaTags } from '$lib/clean/head';
  import * as Page from '$lib/clean/page';
  import TitleCompact from '$lib/clean/head/TitleCompact.svelte';
  import TitleFull from '$lib/clean/head/TitleFull.svelte';

  let { data } = $props();

  const Title = $derived(data.compact ? TitleCompact : TitleFull);
</script>

<Title />
<MetaTags />

<Page.Heading>Component resolution canary</Page.Heading>
<p>Nothing on this page sets a head tag or a heading directly.</p>
