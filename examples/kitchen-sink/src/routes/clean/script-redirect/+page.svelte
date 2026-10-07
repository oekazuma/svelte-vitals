<!-- Redirect-only canary: the script throws on every render, so the page never renders and must
produce no route-level findings. -->
<script lang="ts">
  import { redirect } from '@sveltejs/kit';

  throw redirect(308, '/clean');
</script>
