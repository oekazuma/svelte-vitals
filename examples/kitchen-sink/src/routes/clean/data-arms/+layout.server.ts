import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({ user: null as { name: string } | null });
