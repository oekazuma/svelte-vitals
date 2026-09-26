<!-- Rendered inside a parent's <svelte:head>, so this top-level <title> is the document title. -->
<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<title>{text}</title>
