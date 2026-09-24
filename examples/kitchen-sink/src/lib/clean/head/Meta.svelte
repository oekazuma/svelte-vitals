<script lang="ts">
  let { name, property, content }: { name?: string; property?: string; content: string } = $props();
</script>

<meta {name} {property} {content} />
