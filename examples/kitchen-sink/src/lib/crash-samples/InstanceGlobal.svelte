<!--
  glob-collected, never imported — importing this crashes prerender: a
  component's instance script runs on the server during SSR, and window
  doesn't exist there.
-->
<script lang="ts">
  const width = window.innerWidth; // correctness/instance-browser-global
</script>

<p>{width}</p>
