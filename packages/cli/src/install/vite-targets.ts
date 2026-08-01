export type ViteTargetId = 'vite-plugin' | 'vite-hooks';

export interface ViteTarget {
  id: ViteTargetId;
  label: string;
  hint: string;
}

// Vite install targets with metadata for the CLI wizard
export const VITE_TARGETS: ViteTarget[] = [
  {
    id: 'vite-plugin',
    label: 'Vite plugin (build gate)',
    hint: 'Fails `vite build` when prerendered pages cross the SEO/Performance threshold'
  },
  {
    id: 'vite-hooks',
    label: 'Live dashboard accuracy',
    hint: 'Feeds real rendered results into the live dashboard as you browse — improves per-route accuracy, never fails a build'
  }
];

// Lookup a Vite target by its id
export function viteTargetById(id: string): ViteTarget | undefined {
  return VITE_TARGETS.find((t) => t.id === id);
}

/** Whether an id is one of the Vite install targets (as opposed to an agent/config/CI target id). */
export function isViteTargetId(id: string): id is ViteTargetId {
  return VITE_TARGETS.some((t) => t.id === id);
}
