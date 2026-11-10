import { sequence } from '@sveltejs/kit/hooks';
import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';

export const handle = sequence(svelteVitalsHandle());
