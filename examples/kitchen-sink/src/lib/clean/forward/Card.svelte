<!-- Passes `view` on unchanged: the page's literal decides the arm in <Media>. -->
<script lang="ts">
  import Media from './Media.svelte';

  let { view }: { view: 'compact' | 'cozy' } = $props();
</script>

<Media {view} />
