<script lang="ts">
  type Draft = { title: string };

  let { draft = $bindable() as Draft } = $props();
</script>

<label>
  Title
  <input value={draft.title} oninput={(e) => (draft.title = e.currentTarget.value)} />
</label>
