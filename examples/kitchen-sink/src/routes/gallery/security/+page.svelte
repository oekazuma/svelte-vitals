<script lang="ts">
  let { data } = $props();

  // security/raw-html
  const markup = '<strong>bold</strong>';
</script>

<h1>Security defects</h1>

<!-- security/javascript-url -->
<a href="javascript:alert('hi')">Click for nothing</a>

{@html markup}

<p>Server request count: {data.requestCount}</p>
<p>Server-mutated shared filter: {data.query}</p>
<p>Boot config version: {data.version}</p>
