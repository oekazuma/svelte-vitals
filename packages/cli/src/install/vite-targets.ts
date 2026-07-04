export type ViteTargetId = 'vite-plugin' | 'vite-dev-overlay';

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
    id: 'vite-dev-overlay',
    label: 'Dev overlay',
    hint: 'Live warnings in `vite dev` only — never fails a build or CI'
  }
];

// Lookup a Vite target by its id
export function viteTargetById(id: string): ViteTarget | undefined {
  return VITE_TARGETS.find((t) => t.id === id);
}

/** Whether an id is one of the Vite install targets (as opposed to an MCP client id). */
export function isViteTargetId(id: string): id is ViteTargetId {
  return VITE_TARGETS.some((t) => t.id === id);
}
