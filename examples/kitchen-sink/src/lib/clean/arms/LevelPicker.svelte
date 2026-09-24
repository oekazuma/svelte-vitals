<script lang="ts">
  let { config, onChange }: { config: { levels: string[] }; onChange: (levels: string[]) => void } = $props();

  // `config.levels` and the type's `levels` parameter are other bindings: this list never changes.
  const levels = ['info', 'warn', 'error'];

  function toggle(level: string, on: boolean) {
    onChange(on ? [...config.levels, level] : config.levels.filter((l) => l !== level));
  }
</script>

<fieldset>
  <legend>Log levels</legend>
  {#each levels as level}
    <label>
      <input
        type="checkbox"
        checked={config.levels.includes(level)}
        onchange={(e) => toggle(level, e.currentTarget.checked)}
      />
      {level}
    </label>
  {/each}
</fieldset>
