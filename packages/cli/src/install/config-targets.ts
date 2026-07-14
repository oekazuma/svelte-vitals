export type ConfigTargetId = 'config-file';

export interface ConfigTarget {
  id: ConfigTargetId;
  label: string;
  hint: string;
  /** Default cwd-relative destination path — the fallback extension when nothing else is
   * detected. `index.ts`'s planForConfigTarget picks the actual extension per environment
   * (see config-file-format.ts) rather than always using this literally. */
  relPath: string;
}

// Config-file install target with metadata for the CLI wizard. Like the agent targets
// (and unlike the two Vite targets), this is wholly generated rather than codemodded, so
// --force is safe to apply (see index.ts).
export const CONFIG_TARGETS: ConfigTarget[] = [
  {
    id: 'config-file',
    label: 'Config file',
    hint: 'Scaffolds svelte-vitals.config.{mjs,ts} (auto-picks the best one) with every option commented out',
    relPath: 'svelte-vitals.config.mjs'
  }
];

/** Lookup a config-file install target by its id. */
export function configTargetById(id: string): ConfigTarget | undefined {
  return CONFIG_TARGETS.find((t) => t.id === id);
}

/** Whether an id is the config-file install target. */
export function isConfigTargetId(id: string): id is ConfigTargetId {
  return CONFIG_TARGETS.some((t) => t.id === id);
}
